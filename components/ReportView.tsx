'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { displayedPropertyScore, scoreAvailable, reportVerdict, scoreBasisLine, scoreExplanation } from '@/lib/report-integrity';
import type { Report } from '@/lib/types';
import type { MortgageRateSnapshot } from '@/lib/fmh-mortgage-rate';
import { canonicalSource, reportSubtitle, reportTitle, resolveLocation } from '@/lib/display';
import { formatScore, grossYieldLine, priceNotCheckedLine, scoreAdjustmentLine } from '@/lib/property-score';
import { copy, localePath, localizedFeatures, type Locale } from '@/lib/i18n';
import { clarifyBeforeDecision, glanceFacts, localizedConsiderations, localizedSummary, localizedWarnings } from '@/lib/report-copy';
import { redFlagSentence } from '@/lib/red-flags';
import { AdSlot } from './AdSlot';
import { Brand } from './Brand';
import { FinanceCalculator } from './FinanceCalculator';
import { LanguageSwitch } from './LanguageSwitch';
import { AccountNav } from './AccountNav';
import { PlanButton } from './PlanButton';
import { LocationCard } from './LocationCard';
import { OfferQuestions } from './OfferQuestions';
import { Sidebar } from './Sidebar';
import { CountrySwitch } from './CountrySwitch';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';
import { cleanPdfDisplayName, pdfDownloadName } from '@/lib/pdf-source';
import { ReportNote } from './ReportNote';
import { ReportPrintButton } from './ReportPrintButton';
import { localizedFactualTaxonomy, TAXONOMY_VERSION } from '@/lib/property-taxonomy';
import { ListingPhotos } from './ListingPhotos';
import { PriceCheckCard } from './PriceCheckCard';
import { priceCheckPresentation } from '@/lib/price-check-copy';

export function ReportView({ report: initialReport, locale, mortgageRate, renderedAt }: { report: Report; locale: Locale; mortgageRate?: MortgageRateSnapshot; renderedAt?: number }) {
  const [report, setReport] = useState(initialReport);
  const [copied, setCopied] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<{ billingAvailable?: boolean }> : null)
      .then((data) => setShowPlans(Boolean(data?.billingAvailable)))
      .catch(() => setShowPlans(false));
  }, []);

  useEffect(() => {
    if ((report.verificationAttempted || (report.aiLocationChecked && report.aiFactChecked)) && (!report.taxonomyEvidence || (report.jevCategorized && report.taxonomy?.version === TAXONOMY_VERSION))) return;
    let active = true;
    let attempts = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/reports/${report.id}`, { cache: 'no-store' });
        if (!response.ok || !active) return;
        const latest = await response.json() as Report;
        if (!active) return;
        setReport(latest);
        if ((latest.verificationAttempted || (latest.aiLocationChecked && latest.aiFactChecked)) && (!latest.taxonomyEvidence || latest.jevCategorized)) return;
      } catch {
        // The saved deterministic report remains usable while verification retries.
      }
      attempts += 1;
      if (active && attempts < 15) timeout = setTimeout(refresh, 2_000);
    };
    timeout = setTimeout(refresh, 1_000);
    return () => { active = false; clearTimeout(timeout); };
  }, [report.aiFactChecked, report.aiLocationChecked, report.jevCategorized, report.taxonomy?.version, report.id]);

  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem('habitat-history') || '[]') as string[];
    const knownIds = [...new Set([...ids, report.id])].slice(-30);
    fetch(`/api/reports?ids=${encodeURIComponent(knownIds.join(','))}`).then((response) => response.json() as Promise<Report[]>).then((all) => {
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
  const priceView = priceCheckPresentation(report, locale);
  const glance = glanceFacts(report, locale);
  if (priceView.kind === 'matched') {
    const perSqm = glance.findIndex(([label]) => label === text.perSqm);
    glance.splice(perSqm >= 0 ? perSqm + 1 : glance.length, 0, [priceView.glanceLabel, priceView.glanceValue]);
  }
  const propertyScore = displayedPropertyScore(report);
  const verdict = reportVerdict(report, locale);
  const verdictText = /[.!?]$/.test(verdict) ? verdict : `${verdict}.`;
  const breakdown = propertyScore.breakdown;
  const showScore = scoreAvailable(report);
  const priceNote = showScore ? priceNotCheckedLine(report, locale) : '';
  const adjustmentLines = showScore ? propertyScore.adjustments.map((item) => scoreAdjustmentLine(item, locale)) : [];
  const yieldNote = showScore ? grossYieldLine(report, locale) : '';
  const summary = localizedSummary(report, locale);
  const considerations = localizedConsiderations(report, locale);
  const warnings = localizedWarnings(report, locale);
  const clarify = clarifyBeforeDecision(report, locale);
  const features = localizedFeatures(facts.features, locale);
  const redFlags = report.redFlags || [];
  const propertyCategories = localizedFactualTaxonomy(report, locale);

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
        <div className="report-actions"><Brand className="report-brand" locale={locale}/><div className="report-action-controls"><button className={copied ? 'share-button copied' : 'share-button'} onClick={copyLink} aria-label={copied ? text.copied : text.copyLink}><span aria-hidden="true">{copied ? '✓' : '↗'}</span><span className="action-label-long" aria-live="polite">{copied ? text.copied : text.copyLink}</span><span className="action-label-short" aria-hidden="true">{copied ? (locale === 'de' ? 'Kopiert' : 'Copied') : (locale === 'de' ? 'Link' : 'Copy')}</span></button><ReportPrintButton reportId={report.id} locale={locale}/><AccountNav locale={locale}/><LanguageSwitch locale={locale}/></div></div>
        <div className="report-title-block"><div className="report-market-line"><p className="eyebrow">{text.brief}</p><CountrySwitch locale={locale}/></div><h1>{reportTitle(report, locale)}</h1>{subtitle && <p><a className="report-address-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery || subtitle)}`} target="_blank" rel="noreferrer" aria-label={`${subtitle} — Google Maps`}>{subtitle}<span aria-hidden="true">↗</span></a></p>}</div>
      </header>

      <ListingPhotos urls={facts.photoUrls} listingUrl={report.source} locale={locale} renderedAt={renderedAt} />

      <section className="verdict">
        <div className="score-column"><details className="score-details"><summary><small>{text.score}</small><span className="score-display"><strong>{showScore ? formatScore(propertyScore.total, locale) : '—'}</strong>{showScore ? <i>/ 10</i> : null}</span><span className="score-basis">{scoreBasisLine(report, locale)}</span>{priceNote ? <span className="score-note">{priceNote}</span> : null}{adjustmentLines.map((line) => <span className="score-note" key={line}>{line}</span>)}{yieldNote ? <span className="score-note">{yieldNote}</span> : null}<span className="score-details-prompt">{text.scoreDetails} <b>＋</b></span></summary><div className="score-popover">{showScore ? <p>{scoreExplanation(report, locale)}</p> : null}<div className="score-method">{Object.entries(text.components).map(([key, label]) => {
          const value = breakdown[key as keyof typeof breakdown];
          const unscored = value === null;
          const figure = unscored || !showScore ? '—' : formatScore(value, locale);
          return <span key={key} className={unscored ? 'is-unscored' : undefined}>{label} <b>{figure}</b>{unscored ? <em>{text.priceNotScored}</em> : null}</span>;
        })}</div><Link className="score-method-link" href={localePath(locale, '/method')}>{text.howWeReview}</Link></div></details></div>
        <div className="verdict-copy"><h2>{verdictText}</h2><div className="summary-copy">{summary.split(/\n\n+/).map((paragraph) => <p key={paragraph}><GlossaryText locale={locale}>{paragraph}</GlossaryText></p>)}</div></div>
      </section>

      {clarify.length ? <section className="card integrity-alert" role="status"><strong>{locale === 'de' ? 'Vor einer Entscheidung klären' : 'Clarify before making a decision'}</strong>{clarify.map(w => <p key={w}>{w}</p>)}</section> : null}
      <div className="report-grid">
        <div>
          <section className="card"><p className="eyebrow">{text.atGlance}</p><div className="facts">{glance.map(([key, value]) => <div key={key}><small><GlossaryText locale={locale}>{key}</GlossaryText></small><b><GlossaryText locale={locale}>{value}</GlossaryText></b></div>)}</div></section>
          <PriceCheckCard report={report} locale={locale} />
          <section className="card red-flags"><p className="eyebrow">{text.redFlags}</p>{redFlags.length ? redFlags.map(flag => <div className={`red-flag red-flag-${flag.severity}`} key={flag.id}><p><span className="red-flag-dot" aria-hidden="true" /><span className="red-flag-label">{flag.severity === 'high' ? text.redFlagSerious : text.redFlagCheck}</span> <GlossaryText locale={locale}>{redFlagSentence(report, flag, locale)}</GlossaryText></p>{flag.evidence ? <blockquote><small>{text.redFlagFrom}</small> {flag.evidence}</blockquote> : null}</div>) : <p className="red-flags-empty">{text.redFlagsEmpty}</p>}</section>
          {propertyCategories.length ? <section className="card property-profile"><p className="eyebrow">{text.profile}</p><div className="feature-list">{propertyCategories.map(category => <span key={category}>{category}</span>)}</div></section> : null}
          {features.length ? <section className="card listing-details"><p className="eyebrow">{text.details}</p><div className="feature-list">{features.map((feature, index) => <span key={`${feature}-${index}`}><GlossaryText locale={locale}>{feature}</GlossaryText></span>)}</div></section> : null}
          <section className="card"><p className="eyebrow">{text.matters}</p>{considerations.map((item, index) => <div className="signal" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p><GlossaryText locale={locale}>{item}</GlossaryText></p></div>)}</section>
          {warnings.length ? <section className="card data-notes"><p className="eyebrow">{text.notes}</p>{warnings.map((item) => <p key={item}><GlossaryText locale={locale}>{item}</GlossaryText></p>)}</section> : null}
          {report.evidence ? <details className="card source-evidence"><summary>{locale === 'de' ? 'Belege aus dem Angebot ansehen' : 'View source evidence'}</summary><p>{locale === 'de' ? 'Auszüge aus der Quelle. Angaben des Verkäufers sind nicht unabhängig bestätigt.' : 'Excerpts from the source. Seller statements have not been independently verified.'}</p>{Object.entries(report.evidence).filter(([, lines]) => lines.length).map(([field, lines]) => <div key={field}>{lines.map((line, i) => <blockquote key={i}>{line}</blockquote>)}</div>)}</details> : null}
          {location.mapQuery ? <LocationCard location={location} locale={locale} reportId={report.id} geocode={report.geocode} /> : null}
        </div>
        <aside>
          <FinanceCalculator report={report} locale={locale} initialRate={mortgageRate} />
          <ReportNote reportId={report.id} locale={locale} />
          <OfferQuestions report={report} locale={locale} />
          <AdSlot locale={locale} kind="finance" compact />
          <section className="card source"><p className="eyebrow">{text.source}</p>{report.source.startsWith('http') ? <a href={report.source} target="_blank" rel="noreferrer">{text.original}</a> : report.sourceFile ? <><p>{cleanPdfDisplayName(report.sourceFile.displayName)}</p><a href={`/api/reports/${report.id}/source`} download={pdfDownloadName(report.sourceFile.displayName)}>{text.downloadPdf}</a></> : <p>{cleanPdfDisplayName(report.source)}</p>}<small>{text.saved} · {new Date(report.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</small></section>
        </aside>
      </div>

      {showPlans ? <section className="plans">
        <div><p className="eyebrow">{text.assessMore}</p><h2>{text.plansTitle}</h2><p>{text.plansCopy}</p></div>
        <article><span>PRO</span><strong>€10<small>{text.perMonth}</small></strong><p>{text.proLimit}</p><PlanButton plan="pro" locale={locale}>{text.proButton}</PlanButton></article>
        <article className="ultra"><span>ULTRA</span><strong>€20<small>{text.perMonth}</small></strong><p>{text.ultraLimit}</p><PlanButton plan="ultra" locale={locale}>{text.ultraButton}</PlanButton></article>
      </section> : null}
      <SiteFooter locale={locale} />
    </main>
  </>;
}
