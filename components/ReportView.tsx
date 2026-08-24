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
import { LocationCard } from './LocationCard';
import { OfferQuestions } from './OfferQuestions';
import { Sidebar } from './Sidebar';

const euros = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);

export function ReportView({ report, locale }: { report: Report; locale: Locale }) {
  const [copied, setCopied] = useState(false);

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
  const glance: Array<[string, string]> = [
    [text.asking, euros(facts.price)],
    [text.perSqm, facts.area ? euros(facts.price / facts.area) : text.notDisclosed],
    [text.living, facts.area ? `${facts.area} m²` : text.notDisclosed],
    ...(facts.usableArea ? [[text.usable, `${facts.usableArea} m²`] as [string, string]] : []),
    [text.rooms, known(facts.rooms)],
    [text.floor, known(facts.floor)],
    ...(facts.tenancy ? [[text.use, known(facts.tenancy)] as [string, string]] : []),
    ...(facts.housegeld ? [['Hausgeld', `${euros(facts.housegeld)} ${text.monthly}`] as [string, string]] : []),
    ...(facts.advertisedYield ? [[text.return, `${facts.advertisedYield.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB')}%`] as [string, string]] : []),
    [text.sun, known(report.sunOrientation)],
    ...(report.daylight ? [[text.daylight, known(report.daylight)] as [string, string]] : []),
    [text.energy, `${known(facts.energy)}${facts.energyDemand ? ` · ${facts.energyDemand.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB')} kWh/(m²a)` : ''}`],
    [text.heating, `${known(facts.heating)}${facts.energySource ? ` · ${facts.energySource}` : ''}`],
    [text.built, known(facts.year)],
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
        <div className="report-actions"><Brand className="report-brand" locale={locale}/><div className="report-action-controls"><button className={copied ? 'share-button copied' : 'share-button'} onClick={copyLink}><span aria-hidden="true">{copied ? '✓' : '↗'}</span><span aria-live="polite">{copied ? text.copied : text.copyLink}</span></button><LanguageSwitch locale={locale}/></div></div>
        <div className="report-title-block"><p className="eyebrow">{text.brief}</p><h1>{reportTitle(report, locale)}</h1>{subtitle && <p><a className="report-address-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery || subtitle)}`} target="_blank" rel="noreferrer" aria-label={`${subtitle} — Google Maps`}>{subtitle}<span aria-hidden="true">↗</span></a></p>}</div>
      </header>

      <section className="verdict">
        <div className="score-column"><details className="score-details"><summary><small>{text.score}</small><span className="score-display"><strong>{propertyScore.total.toFixed(2)}</strong><i>/ 10</i></span><span className="score-details-prompt">{text.scoreDetails} <b>＋</b></span></summary><div className="score-popover"><p>{text.scoreExplainer}</p><div className="score-method">{Object.entries(text.components).map(([key, label]) => <span key={key}>{label} <b>{breakdown[key as keyof typeof breakdown].toFixed(1)}</b></span>)}</div></div></details><span className="score-basis">{text.deterministic}</span></div>
        <div className="verdict-copy"><h2>{propertyScoreTitle(propertyScore.total, locale)}.</h2><div className="summary-copy">{summary.split(/\n\n+/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></div>
      </section>

      <div className="report-grid">
        <div>
          <section className="card"><p className="eyebrow">{text.atGlance}</p><div className="facts">{glance.map(([key, value]) => <div key={key}><small>{key}</small><b>{value}</b></div>)}</div></section>
          {facts.features?.length ? <section className="card listing-details"><p className="eyebrow">{text.details}</p><div className="feature-list">{facts.features.map((feature) => <span key={feature}>{feature}</span>)}</div></section> : null}
          <section className="card"><p className="eyebrow">{text.matters}</p>{considerations.map((item, index) => <div className="signal" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>)}</section>
          {warnings.length ? <section className="card data-notes"><p className="eyebrow">{text.notes}</p>{warnings.map((item) => <p key={item}>{item}</p>)}</section> : null}
          {location.mapQuery ? <LocationCard location={location} locale={locale} /> : null}
        </div>
        <aside>
          <FinanceCalculator report={report} locale={locale} />
          <OfferQuestions report={report} locale={locale} />
          <AdSlot locale={locale} kind="finance" compact />
          <section className="card source"><p className="eyebrow">{text.source}</p>{report.source.startsWith('http') ? <a href={report.source} target="_blank" rel="noreferrer">{text.original}</a> : <p>{report.source}</p>}<small>{text.saved} · {new Date(report.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</small></section>
        </aside>
      </div>

      <section className="plans">
        <div><p className="eyebrow">{text.assessMore}</p><h2>{text.plansTitle}</h2><p>{text.plansCopy}</p></div>
        <article><span>PRO</span><strong>€10<small>{text.perMonth}</small></strong><p>{text.proLimit}</p><button>{text.proButton}</button></article>
        <article className="ultra"><span>ULTRA</span><strong>€20<small>{text.perMonth}</small></strong><p>{text.ultraLimit}</p><button>{text.ultraButton}</button></article>
      </section>
    </main>
  </>;
}
