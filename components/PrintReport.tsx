import { scoreAvailable, reportVerdict } from '@/lib/report-integrity';
import type { Report } from '@/lib/types';
import { copy, localizedTenancy, localizedValue, type Locale } from '@/lib/i18n';
import { reportSubtitle, reportTitle, resolveLocation } from '@/lib/display';
import { calculatePropertyScore, propertyScoreTitle } from '@/lib/property-score';
import { localizedConsiderations, localizedSummary, localizedWarnings, offerQuestionsFor, questionsAreConcise } from '@/lib/report-copy';
import { redFlagSentence } from '@/lib/red-flags';
import { acquisitionCosts, financingScenario } from '@/lib/finance';
import { cleanPdfDisplayName } from '@/lib/pdf-source';
import { HomeMark } from './Brand';
import { PrintControls } from './PrintControls';

const euros = (value: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

type FinanceSettings = { equity: number; interest: number; repayment: number; includeHousegeld: boolean };

export function PrintReport({ report, locale, finance, autoPrint }: { report: Report; locale: Locale; finance: FinanceSettings; autoPrint: boolean }) {
  const de = locale === 'de';
  const reportText = copy[locale].report;
  const financeText = copy[locale].finance;
  const score = calculatePropertyScore(report);
  const showScore = scoreAvailable(report);
  const summary = localizedSummary(report, locale);
  const considerations = localizedConsiderations(report, locale);
  const warnings = localizedWarnings(report, locale);
  const storedQuestions = de ? report.offerQuestionsDe : report.offerQuestions;
  const questions = questionsAreConcise(storedQuestions) ? storedQuestions : offerQuestionsFor(report, locale);
  const location = resolveLocation(report);
  const subtitle = reportSubtitle(report);
  const costs = acquisitionCosts(report.facts);
  const scenario = financingScenario({ total: costs.total, ...finance, housegeld: report.facts.housegeld });
  const known = (value?: string) => Boolean(value && !/not stated|unknown|not disclosed|could(?:n't| not) find/i.test(value));
  const localized = (value?: string) => localizedValue(value, locale);
  const facts: Array<[string, string]> = [
    ...(report.facts.price ? [[reportText.asking, euros(report.facts.price)] as [string, string]] : []),
    ...(report.facts.price && report.facts.area ? [[reportText.perSqm, euros(report.facts.price / report.facts.area)] as [string, string]] : []),
    ...(report.facts.area ? [[reportText.living, `${report.facts.area} m²`] as [string, string]] : []),
    ...(report.facts.plotArea ? [[reportText.plot, `${report.facts.plotArea.toLocaleString(de ? 'de-DE' : 'en-GB')} m²`] as [string, string]] : []),
    ...(report.facts.usableArea ? [[reportText.usable, `${report.facts.usableArea} m²`] as [string, string]] : []),
    ...(known(report.facts.rooms) ? [[reportText.rooms, localized(report.facts.rooms)] as [string, string]] : []),
    ...(known(report.facts.floor) ? [[reportText.floor, localized(report.facts.floor)] as [string, string]] : []),
    ...(known(report.facts.tenancy) ? [[reportText.use, localizedTenancy(report.facts.tenancy, report.facts.availabilityDate, locale)] as [string, string]] : []),
    ...(known(report.facts.condition) ? [[reportText.condition, localized(report.facts.condition)] as [string, string]] : []),
    ...(report.facts.soldAsIs ? [[de ? 'Verkauf' : 'Sale', de ? 'Ist-Zustand' : 'As-is'] as [string, string]] : []),
    ...(report.facts.buyerCommission ? [[reportText.commission, localized(report.facts.buyerCommission)] as [string, string]] : []),
    ...(known(report.facts.year) ? [[reportText.built, localized(report.facts.year)] as [string, string]] : []),
    ...(known(report.facts.energy) ? [[reportText.energy, localized(report.facts.energy)] as [string, string]] : []),
    ...(known(report.facts.heating) || report.facts.energySource ? [[reportText.heating, `${known(report.facts.heating) ? localized(report.facts.heating) : ''}${report.facts.energySource ? `${known(report.facts.heating) ? ' · ' : ''}${localized(report.facts.energySource)}` : ''}`] as [string, string]] : []),
    ...(report.facts.housegeld ? [['Hausgeld', `${euros(report.facts.housegeld)} ${reportText.monthly}${report.facts.housegeldYear ? ` (${report.facts.housegeldYear})` : ''}`] as [string, string]] : []),
  ];
  const labels = de ? {
    document: 'IMMOBILIEN-BERICHT', overview: 'Auf einen Blick', matters: 'Was wichtig ist', questions: 'Vor dem Angebot fragen', finance: 'Finanzierung', location: 'Lage', source: 'Quelle', notes: 'Hinweise zu den Daten', generated: 'Erstellt', monthly: 'Monatliche Kosten', score: 'Angebotsraster', details: 'Score-Details', loanPayment: 'Kreditrate', equity: 'Eigenkapital', terms: 'Kalkulationszins + Tilgung', total: 'Gesamte Kaufkosten', approximate: 'Die genaue Adresse wurde im Exposé nicht genannt.', disclaimer: 'Kein Wertgutachten oder Finanzierungsangebot', pdfSource: 'Exposé PDF', redFlags: 'Warnsignale', redFlagsEmpty: 'Im Angebotstext keine Warnsignale gefunden. Das ist keine Garantie, prüfe die Unterlagen.', serious: 'Ernst', check: 'Prüfen', fromListing: 'Aus dem Angebot:',
  } : {
    document: 'PROPERTY REPORT', overview: 'At a glance', matters: 'What matters', questions: 'Ask before you offer', finance: 'Financing scenario', location: 'Location', source: 'Source', notes: 'Data notes', generated: 'Created', monthly: 'Known monthly outlay', score: 'Listing rubric', details: 'Score details', loanPayment: 'Loan payment', equity: 'Equity', terms: 'Rate + repayment', total: 'Total acquisition cost', approximate: 'The listing did not disclose an exact address.', disclaimer: 'Not a valuation or financing offer', pdfSource: 'Exposé PDF', redFlags: 'Red flags', redFlagsEmpty: 'No red flags found in the listing text. That is not a guarantee, so check the documents.', serious: 'Serious', check: 'Check', fromListing: 'From the listing:',
  };
  const returnUrl = `${de ? '/de' : ''}/r/${report.id}`;
  const mapsUrl = location.mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery)}` : '';

  return <main className="print-report-page" lang={locale}>
    <PrintControls returnUrl={returnUrl} locale={locale} autoPrint={autoPrint} />
    <article className="print-report">
      <header className="print-header">
        <a className="print-brand" href="https://reviewahouse.com"><HomeMark /><span>Review a House</span></a>
        <div><b>{labels.document}</b><span>{labels.generated} · {new Date(report.createdAt).toLocaleDateString(de ? 'de-DE' : 'en-GB')}</span></div>
      </header>

      <section className="print-hero">
        <div><p>{labels.document}</p><h1>{reportTitle(report, locale)}</h1>{subtitle ? <h2>{subtitle}</h2> : null}</div>
        <div className="print-score"><span>{labels.score}</span><strong>{showScore ? score.total.toFixed(1) : '—'}{showScore ? <small>/10</small> : null}</strong><em>{reportVerdict(report, locale)}</em></div>
      </section>

      <section className="print-summary">{summary.split(/\n\n+/).map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>

      <section className="print-section">
        <h3>{labels.overview}</h3>
        <div className="print-facts">{facts.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
      </section>

      <section className="print-section print-flags">
        <h3>{labels.redFlags}</h3>
        {(report.redFlags || []).length ? <ul>{(report.redFlags || []).map(flag => <li key={flag.id}><strong>{flag.severity === 'high' ? labels.serious : labels.check}.</strong> {redFlagSentence(report, flag, locale)}{flag.evidence ? <blockquote><small>{labels.fromListing}</small> {flag.evidence}</blockquote> : null}</li>)}</ul> : <p>{labels.redFlagsEmpty}</p>}
      </section>

      <section className="print-split print-section">
        <div><h3>{labels.matters}</h3><ol className="print-numbered">{considerations.map((item, index) => <li key={item}><span>{index + 1}</span><p>{item}</p></li>)}</ol></div>
        <div><h3>{labels.questions}</h3><ol className="print-questions">{questions.map(item => <li key={item}>{item}</li>)}</ol></div>
      </section>

      <section className="print-finance print-section">
        <div className="print-finance-total"><span>{labels.monthly}</span><strong>{euros(scenario.knownOutlay)}</strong>{report.facts.housegeld && finance.includeHousegeld ? <small>{euros(scenario.loanPayment)} {de ? 'Kredit' : 'loan'} + {euros(report.facts.housegeld)} Hausgeld</small> : null}</div>
        <div className="print-finance-grid">
          <div><small>{labels.loanPayment}</small><strong>{euros(scenario.loanPayment)}</strong></div>
          <div><small>{labels.equity}</small><strong>{euros(finance.equity)}</strong></div>
          <div><small>{labels.terms}</small><strong>{finance.interest.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% + {finance.repayment.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong></div>
          <div><small>{labels.total}</small><strong>{euros(costs.total)}</strong></div>
        </div>
        <p>{financeText.note}</p>
      </section>

      <section className="print-split print-section print-bottom">
        <div><h3>{labels.location}</h3><p><strong>{mapsUrl ? <a href={mapsUrl}>{location.mapLabel || subtitle}<span aria-hidden="true">↗</span></a> : location.mapLabel || subtitle}</strong></p>{!location.exact ? <p>{labels.approximate}</p> : null}</div>
        <div><h3>{labels.details}</h3><div className="print-score-grid">{Object.entries(reportText.components).map(([key, label]) => <span key={key}>{label}<b>{showScore ? score.breakdown[key as keyof typeof score.breakdown].toFixed(1) : '—'}</b></span>)}</div></div>
      </section>

      <p className="print-section">{reportText.scoreExplainer}</p>
      {warnings.length ? <section className="print-section print-warnings"><h3>{labels.notes}</h3><ul>{warnings.map(item => <li key={item}>{item}</li>)}</ul></section> : null}

      <footer className="print-footer">
        <div><b>{labels.source}</b>{report.source.startsWith('http') ? <a href={report.source}>{report.source}</a> : <span>{labels.pdfSource} · {cleanPdfDisplayName(report.sourceFile?.displayName || report.source)}</span>}</div>
        <p>{labels.disclaimer} · <a href="https://reviewahouse.com">reviewahouse.com</a></p>
      </footer>
    </article>
  </main>;
}
