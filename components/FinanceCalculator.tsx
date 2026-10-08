'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Report } from '@/lib/types';
import type { MortgageRateSnapshot } from '@/lib/fmh-mortgage-rate';
import { copy, financeFootnote, type Locale } from '@/lib/i18n';
import { acquisitionCosts, defaultEquity, financingScenario } from '@/lib/finance';
import { buyerCostView, type BuyerCostRowView } from '@/lib/buyer-costs';
import { money, percent } from '@/lib/format';
import { provenanceForField, type FactProvenance, type FeedbackField } from '@/lib/fact-provenance';
import { factSourceCopy } from '@/lib/fact-source-copy';
import { GlossaryText } from './GlossaryText';
import { FactSource } from './FactSource';

const RATE_FETCH_TIMEOUT_MS = 12_000;

function lineField(key: string): FeedbackField {
  if (key === 'tax') return 'transferTax';
  if (key === 'notary') return 'notary';
  return 'buyerCommission';
}

/** The line already explains itself. The popover repeats that basis and can report it. */
function lineProvenance(report: Report, row: BuyerCostRowView, locale: Locale): FactProvenance {
  const field = lineField(row.key);
  const reportedValue = row.amount || row.label;
  if (field === 'buyerCommission') {
    const excerpt = report.factEvidence?.buyerCommission?.excerpt;
    if (excerpt) return { field, kind: 'stated', quotes: [excerpt], reportedValue };
    if (/not stated|nicht angegeben/i.test(row.basis)) return { field, kind: 'estimated', quotes: [], basis: row.basis, reportedValue };
    return { field, kind: 'calculated', quotes: [], formula: row.basis, reportedValue };
  }
  if (field === 'notary' || /state not identified|Bundesland unklar|kein Bundesland/i.test(row.basis)) {
    return { field, kind: 'estimated', quotes: [], basis: row.basis, reportedValue };
  }
  return { field, kind: 'calculated', quotes: [], formula: row.basis, reportedValue };
}

export function FinanceCalculator({ report, locale, initialRate, reportingEnabled = false }: { report: Report; locale: Locale; initialRate?: MortgageRateSnapshot; reportingEnabled?: boolean }) {
  const costs = acquisitionCosts(report);
  const costView = buyerCostView(report, locale);
  const sliderMax = costs.totalHigh ?? costs.total;
  const rangedAmount = (low: number, high: number) => {
    const start = money(low, locale);
    const end = money(high, locale);
    return start === end ? start : `${start}–${end}`;
  };
  const initialEquity = defaultEquity(sliderMax);
  const buyerCostsProvenance: FactProvenance = report.factEvidence?.buyerCosts?.excerpt
    ? { field: 'buyerCosts', kind: 'stated', quotes: [report.factEvidence.buyerCosts.excerpt], reportedValue: costView.summaryAmount }
    : costView.estimated
      ? { field: 'buyerCosts', kind: 'estimated', quotes: [], basis: factSourceCopy[locale].buyerCostsUnstated, reportedValue: costView.summaryAmount }
      : { field: 'buyerCosts', kind: 'stated', quotes: [], reportedValue: costView.summaryAmount };
  const totalProvenance: FactProvenance = report.facts.price > 0
    ? { field: 'totalCost', kind: 'calculated', quotes: [], formula: `${money(report.facts.price, locale)} + ${costView.summaryAmount}`, reportedValue: costView.totalAmount }
    : provenanceForField(report, 'totalCost', costView.totalAmount, locale);
  const [equity, setEquity] = useState(initialEquity);
  const [interest, setInterest] = useState(initialRate?.rate ?? 3.5);
  const [mortgageRate, setMortgageRate] = useState<MortgageRateSnapshot | undefined>(initialRate);
  const [rateState, setRateState] = useState<'loading' | 'ready' | 'unavailable'>(initialRate ? 'ready' : 'loading');
  const interestWasEdited = useRef(false);
  const [repayment, setRepayment] = useState(2);
  const [includeHousegeld, setIncludeHousegeld] = useState(true);
  useEffect(() => setEquity(defaultEquity(sliderMax)), [sliderMax]);
  useEffect(() => setIncludeHousegeld(true), [report.facts.housegeld]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, RATE_FETCH_TIMEOUT_MS);
    fetch('/api/mortgage-rate', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Mortgage rate unavailable.');
        return response.json() as Promise<MortgageRateSnapshot>;
      })
      .then((benchmark) => {
        window.clearTimeout(timer);
        if (!active) return;
        setMortgageRate(benchmark);
        setRateState('ready');
        if (!interestWasEdited.current) setInterest(benchmark.rate);
      })
      .catch(() => {
        window.clearTimeout(timer);
        if (!active || (!timedOut && controller.signal.aborted)) return;
        setRateState((state) => (state === 'ready' ? state : 'unavailable'));
      });
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);
  const result = useMemo(() => financingScenario({
    total: costs.total,
    equity,
    interest,
    repayment,
    housegeld: report.facts.housegeld,
    includeHousegeld,
  }), [costs.total, equity, includeHousegeld, interest, repayment, report.facts.housegeld]);
  const highResult = useMemo(() => financingScenario({
    total: sliderMax,
    equity,
    interest,
    repayment,
    housegeld: report.facts.housegeld,
    includeHousegeld,
  }), [equity, includeHousegeld, interest, repayment, report.facts.housegeld, sliderMax]);
  useEffect(() => {
    try {
      sessionStorage.setItem(`reviewahouse-finance-${report.id}`, JSON.stringify({ equity, interest, repayment, includeHousegeld }));
    } catch {
      // Printing safely falls back to the default scenario when storage is unavailable.
    }
  }, [equity, includeHousegeld, interest, repayment, report.id]);

  const text = copy[locale].finance;
  const rateDate = mortgageRate?.observedAt
    ? new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(`${mortgageRate.observedAt}T12:00:00Z`))
    : undefined;
  const sourceText = mortgageRate
    ? `${locale === 'de' ? 'FMH-Durchschnitt' : 'FMH average'} · ${rateDate}${mortgageRate.stale ? ` · ${locale === 'de' ? 'zuletzt verfügbar' : 'last available'}` : ''}`
    : rateState === 'unavailable' ? text.rateUnavailable : text.rateLoading;
  return <section className="card finance-calculator">
    <p className="eyebrow">{text.label}</p>
    <div className="finance-total"><small><GlossaryText locale={locale}>{report.facts.housegeld && includeHousegeld ? text.knownOutlay : text.payment}</GlossaryText></small><strong>{rangedAmount(result.knownOutlay, highResult.knownOutlay)}</strong>{report.facts.housegeld && includeHousegeld ? <em><GlossaryText locale={locale}>{`${rangedAmount(result.loanPayment, highResult.loanPayment)} ${locale === 'de' ? 'Kredit' : 'loan'} + ${money(report.facts.housegeld, locale)} Hausgeld`}</GlossaryText></em> : null}</div>
    {report.facts.housegeld ? <label className="housegeld-toggle">
      <input type="checkbox" checked={includeHousegeld} onChange={(event) => setIncludeHousegeld(event.target.checked)} />
      <span><GlossaryText locale={locale}>{`${text.includeHousegeld} · ${money(report.facts.housegeld, locale)}`}</GlossaryText></span>
    </label> : null}
    {report.facts.housegeldYear ? <p className="finance-caveat">{locale === 'de' ? `Hausgeld laut Angabe für ${report.facts.housegeldYear}; aktuellen Betrag bestätigen.` : `Hausgeld stated for ${report.facts.housegeldYear}; confirm the current amount.`}</p> : null}
    {!report.facts.housegeld && report.propertyType === 'flat' ? <p className="finance-caveat">{locale === 'de' ? 'Hausgeld unbekannt und nicht enthalten. Die Kreditrate ist nicht die gesamte monatliche Belastung.' : 'Hausgeld is unknown and excluded. The loan payment is not the full monthly cost.'}</p> : null}
    {report.facts.parkingPrice ? <p className="finance-caveat">{locale === 'de' ? `Separat genannte Garage/Stellplatz: ${money(report.facts.parkingPrice, locale)}. Nicht in der Gesamtsumme enthalten; Kaufpflicht und Aufpreis klären.` : `Separately quoted parking: ${money(report.facts.parkingPrice, locale)}. Excluded from the total; confirm whether the purchase is required and additional.`}</p> : null}
    <div className="finance-meta">
      <span><GlossaryText locale={locale}>{text.loan}</GlossaryText> <b>{rangedAmount(result.loan, highResult.loan)}</b></span>
      <span><GlossaryText locale={locale}>{text.purchase}</GlossaryText> <b>{report.facts.price ? money(report.facts.price, locale) : '—'}</b></span>
      <details className="buyer-costs" open>
        <summary>
          <span className="buyer-cost-label"><GlossaryText locale={locale}>{costView.title}</GlossaryText>{costView.estimated ? <small> {costView.estimatedMark}</small> : null}</span>
          <b>{costView.summaryAmount}<span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><FactSource reportId={report.id} locale={locale} label={costView.title} provenance={buyerCostsProvenance} reportingEnabled={reportingEnabled} /></span></b>
        </summary>
        {costView.statedNote ? <p className="buyer-cost-note">{costView.statedNote}</p> : null}
        <div className="buyer-cost-lines">
          {costView.rows.map(row => <div className="buyer-cost-line" key={row.key}>
            <span>{row.label}</span>
            <b>{row.amount ? <>{row.amount}{row.share ? <small> · {row.share}</small> : null}</> : null}<FactSource reportId={report.id} locale={locale} label={row.label} provenance={lineProvenance(report, row, locale)} reportingEnabled={reportingEnabled} /></b>
            <small>{row.basis}</small>
          </div>)}
        </div>
        {costView.divergence ? <p className="buyer-cost-note">{costView.divergence}</p> : null}
        <p className="buyer-cost-note">{costView.footnote}</p>
      </details>
      <span><GlossaryText locale={locale}>{text.total}</GlossaryText> <FactSource reportId={report.id} locale={locale} label={text.total} provenance={totalProvenance} reportingEnabled={reportingEnabled} /> <b>{costView.totalAmount}</b></span>
    </div>
    <label>
      <span><span className="finance-field-label"><GlossaryText locale={locale}>{text.equity}</GlossaryText></span><b>{money(equity, locale) || '—'} · {sliderMax ? percent(Math.round(equity / sliderMax * 100), locale, 0) : '—'}{costs.buyerCostsAreRange ? ` ${text.higherTotal}` : ''}</b></span>
      <input type="range" min="0" max={Math.max(sliderMax, 1)} step="1" aria-label={text.equity} value={equity} onChange={(event) => setEquity(Number(event.target.value))} />
    </label>
    <label>
      <span><span className="finance-rate-heading"><GlossaryText locale={locale}>{text.rate}</GlossaryText><FactSource reportId={report.id} locale={locale} label={text.rate} provenance={provenanceForField(report, 'mortgageRate', percent(interest, locale), locale)} reportingEnabled={reportingEnabled} /><a className="finance-rate-source" href={mortgageRate?.sourceUrl || 'https://index.fmh.de/fmh/'} target="_blank" rel="noreferrer">{sourceText} ↗</a></span><b>{percent(interest, locale)}</b></span>
      <input type="range" min="2" max="7" step="0.01" aria-label={text.rate} value={interest} onChange={(event) => { interestWasEdited.current = true; setInterest(Number(event.target.value)); }} />
    </label>
    <label>
      <span><span className="finance-field-label"><GlossaryText locale={locale}>{text.repayment}</GlossaryText></span><b>{percent(repayment, locale, 1)}</b></span>
      <input type="range" min="1" max="5" step="0.1" aria-label={text.repayment} value={repayment} onChange={(event) => setRepayment(Number(event.target.value))} />
    </label>
    <small className="finance-note"><GlossaryText locale={locale}>{financeFootnote(report.propertyType, locale)}</GlossaryText></small>
  </section>;
}
