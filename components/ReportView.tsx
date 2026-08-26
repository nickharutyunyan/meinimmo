'use client';

import { useEffect, useState } from 'react';
import type { Report } from '@/lib/types';
import { canonicalSource, reportSubtitle, reportTitle, resolveLocation } from '@/lib/display';
import { calculatePropertyScore, propertyScoreTitle } from '@/lib/property-score';
import { copy, localizedValue, type Locale } from '@/lib/i18n';
import { localizedConsiderations, localizedSummary, localizedWarnings } from '@/lib/report-copy';
import { AdSlot } from './AdSlot';
import { Brand } from './Brand';
import { FinanceCalculator } from './FinanceCalculator';
import { LanguageSwitch } from './LanguageSwitch';
import { AccountNav } from './AccountNav';
import { PlanButton } from './PlanButton';
import { LocationCard } from './LocationCard';
import { OfferQuestions } from './OfferQuestions';
import { Sidebar } from './Sidebar';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';
import { ReportNote } from './ReportNote';

const euros = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);

export function ReportView({ report: initialReport, locale }: { report: Report; locale: Locale }) {
  const [report, setReport] = useState(initialReport);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (report.aiLocationChecked && report.aiFactChecked) return;
    let active = true;
    let attempts = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/reports/${report.id}`, { cache: 'no-store' });
        if (!response.ok || !active) return;
        const latest = await response.json() as Report;
        if (!active) return;
        setReport(current => {
          const locationChanged = current.location !== latest.location
            || current.facts.district !== latest.facts.district
            || current.facts.street !== latest.facts.street;
          return locationChanged ? latest : current;
        });
        if (latest.aiLocationChecked && latest.aiFactChecked) {
          setReport(latest);
          return;
        }
      } catch {
        // The saved deterministic report remains usable while verification retries.
      }
      attempts += 1;
      if (active && attempts < 15) timeout = setTimeout(refresh, 2_000);
    };
    timeout = setTimeout(refresh, 1_000);
    return () => { active = false; clearTimeout(timeout); };
  }, [report.aiFactChecked, report.aiLocationChecked, report.id]);

  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem('habitat-history') || '[]') as string[];
    fetch('/api/reports').then((response) => response.json() as Promise<Report[]>).then((all) => {
      const sameSourceIds = new Set(all.filter((item) => /^https?:/i.test(report.source) && canonicalSource(item.source) === canonicalSource(report.source)).map((item) => item.id));
      const next = ids.filter((id) => !sameSourceIds.has(id) && id !== report.id);
      next.push(report.id);
      localStorage.setItem('habitat-history', JSON.stringify(next.slice(-20)));
      window.dispatchEvent(new Event('habitat-history-changed'));
    }).catch(() => {
      if (!ids.includes(report.id)) localStorage.setItem('habitat-history', JSON.stringify([...ids, report.id].slice(-20)));
    });
  }, [report.id, report.source]);

  const facts = report.facts;
  const text = copy[locale].report;
  const location = resolveLocation(report);
  const subtitle = reportSubtitle(report);
  const known = (value?: string) => localizedValue(value, locale);
  const stated = (value?: string) => known(value) !== text.notDisclosed;
  const glance: Array<[string, string]> = [
    ...(facts.price ? [[text.asking, euros(facts.price)] as [string, string]] : []),
    ...(facts.price && facts.area ? [[text.perSqm, euros(facts.price / facts.area)] as [string, string]] : []),
    ...(facts.area ? [[text.living, `${facts.area} m²`] as [string, string]] : []),
    ...(facts.usableArea ? [[text.usable, `${facts.usableArea} m²`] as [string, string]] : []),
    ...(stated(facts.rooms) ? [[text.rooms, known(facts.rooms)] as [string, string]] : []),
    ...(stated(facts.floor) ? [[text.floor, known(facts.floor)] as [string, string]] : []),
    ...(stated(facts.tenancy) ? [[text.use, known(facts.tenancy)] as [string, string]] : []),
    ...(stated(facts.condition) ? [[text.condition, known(facts.condition)] as [string, string]] : []),
    ...(facts.housegeld ? [['Hausgeld', `${euros(facts.housegeld)} ${text.monthly}`] as [string, string]] : []),
    ...(facts.advertisedYield ? [[text.return, `${facts.advertisedYield.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB')}%`] as [string, string]] : []),
    ...(stated(report.sunOrientation) ? [[text.sun, known(report.sunOrientation)] as [string, string]] : []),
    ...(report.daylight ? [[text.daylight, known(report.daylight)] as [string, string]] : []),
    ...(stated(facts.energy) || facts.energyDemand ? [[text.energy, `${stated(facts.energy) ? known(facts.energy) : ''}${facts.energyDemand ? `${stated(facts.energy) ? ' · ' : ''}${facts.energyDemand.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB')} kWh/(m²a)` : ''}`] as [string, string]] : []),
    ...(stated(facts.heating) || facts.energySource ? [[text.heating, `${stated(facts.heating) ? known(facts.heating) : ''}${facts.energySource ? `${stated(facts.heating) ? ' · ' : ''}${facts.energySource}` : ''}`] as [string, string]] : []),
    ...(stated(facts.year) ? [[text.built, known(facts.year)] as [string, string]] : []),
  ];
  const propertyScore = calculatePropertyScore(report);
  const breakdown = propertyScore.breakdown;
  const summary = localizedSummary(report, locale);
  const considerations = localizedConsiderations(report, locale);
  const warnings = localizedWarnings(report, locale);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const input = document.createElement('textarea');
      input.value = window.location.href;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <>
    <Sidebar locale={locale} />
    <main className="workspace" lang={locale}>
      <header className="report-head">
        <div className="report-actions"><Brand className="report-brand" locale={locale}/><div className="report-action-controls"><button className={copied ? 'share-button copied' : 'share-button'} onClick={copyLink}><span aria-hidden="true">{copied ? '✓' : '↗'}</span><span aria-live="polite">{copied ? text.copied : text.copyLink}</span></button><AccountNav locale={locale}/><LanguageSwitch locale={locale}/></div></div>
        <div className="report-title-block"><p className="eyebrow">{text.brief}</p><h1>{reportTitle(report, locale)}</h1>{subtitle && <p><a className="report-address-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery || subtitle)}`} target="_blank" rel="noreferrer" aria-label={`${subtitle} — Google Maps`}>{subtitle}<span aria-hidden="true">↗</span></a></p>}</div>
      </header>

      <section className="verdict">
        <div className="score-column"><details className="score-details"><summary><small>{text.score}</small><span className="score-display"><strong>{propertyScore.total.toFixed(2)}</strong><i>/ 10</i></span><span className="score-details-prompt">{text.scoreDetails} <b>＋</b></span></summary><div className="score-popover"><p>{text.scoreExplainer}</p><div className="score-method">{Object.entries(text.components).map(([key, label]) => <span key={key}>{label} <b>{breakdown[key as keyof typeof breakdown].toFixed(1)}</b></span>)}</div></div></details></div>
        <div className="verdict-copy"><h2>{propertyScoreTitle(propertyScore.total, locale)}.</h2><div className="summary-copy">{summary.split(/\n\n+/).map((paragraph) => <p key={paragraph}><GlossaryText>{paragraph}</GlossaryText></p>)}</div></div>
      </section>

      <div className="report-grid">
        <div>
          <section className="card"><p className="eyebrow">{text.atGlance}</p><div className="facts">{glance.map(([key, value]) => <div key={key}><small><GlossaryText>{key}</GlossaryText></small><b><GlossaryText>{value}</GlossaryText></b></div>)}</div></section>
          {facts.features?.length ? <section className="card listing-details"><p className="eyebrow">{text.details}</p><div className="feature-list">{facts.features.map((feature) => <span key={feature}><GlossaryText>{feature}</GlossaryText></span>)}</div></section> : null}
          <section className="card"><p className="eyebrow">{text.matters}</p>{considerations.map((item, index) => <div className="signal" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p><GlossaryText>{item}</GlossaryText></p></div>)}</section>
          {warnings.length ? <section className="card data-notes"><p className="eyebrow">{text.notes}</p>{warnings.map((item) => <p key={item}><GlossaryText>{item}</GlossaryText></p>)}</section> : null}
          {location.mapQuery ? <LocationCard location={location} locale={locale} /> : null}
        </div>
        <aside>
          <FinanceCalculator report={report} locale={locale} />
          <ReportNote reportId={report.id} locale={locale} />
          <OfferQuestions report={report} locale={locale} />
          <AdSlot locale={locale} kind="finance" compact />
          <section className="card source"><p className="eyebrow">{text.source}</p>{report.source.startsWith('http') ? <a href={report.source} target="_blank" rel="noreferrer">{text.original}</a> : <p>{report.source}</p>}<small>{text.saved} · {new Date(report.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</small></section>
        </aside>
      </div>

      <section className="plans">
        <div><p className="eyebrow">{text.assessMore}</p><h2>{text.plansTitle}</h2><p>{text.plansCopy}</p></div>
        <article><span>PRO</span><strong>€10<small>{text.perMonth}</small></strong><p>{text.proLimit}</p><PlanButton plan="pro" locale={locale}>{text.proButton}</PlanButton></article>
        <article className="ultra"><span>ULTRA</span><strong>€20<small>{text.perMonth}</small></strong><p>{text.ultraLimit}</p><PlanButton plan="ultra" locale={locale}>{text.ultraButton}</PlanButton></article>
      </section>
      <SiteFooter locale={locale} />
    </main>
  </>;
}
