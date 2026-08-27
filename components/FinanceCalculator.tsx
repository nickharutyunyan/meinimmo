'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Report } from '@/lib/types';
import type { MortgageRateSnapshot } from '@/lib/fmh-mortgage-rate';
import { copy, type Locale } from '@/lib/i18n';
import { acquisitionCosts, defaultEquity, financingScenario } from '@/lib/finance';
import { GlossaryText } from './GlossaryText';

const euros = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);

export function FinanceCalculator({ report, locale }: { report: Report; locale: Locale }) {
  const { buyerCostsAreEstimated, buyerCosts, total } = acquisitionCosts(report.facts);
  const initialEquity = defaultEquity(total);
  const [equity, setEquity] = useState(initialEquity);
  const [interest, setInterest] = useState(3.5);
  const [mortgageRate, setMortgageRate] = useState<MortgageRateSnapshot>();
  const interestWasEdited = useRef(false);
  const [repayment, setRepayment] = useState(2);
  const [includeHousegeld, setIncludeHousegeld] = useState(true);
  useEffect(() => setEquity(defaultEquity(total)), [total]);
  useEffect(() => setIncludeHousegeld(true), [report.facts.housegeld]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/mortgage-rate', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Mortgage rate unavailable.');
        return response.json() as Promise<MortgageRateSnapshot>;
      })
      .then((benchmark) => {
        setMortgageRate(benchmark);
        if (!interestWasEdited.current) setInterest(benchmark.rate);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const result = useMemo(() => financingScenario({
    total,
    equity,
    interest,
    repayment,
    housegeld: report.facts.housegeld,
    includeHousegeld,
  }), [equity, includeHousegeld, interest, repayment, report.facts.housegeld, total]);
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
    : (locale === 'de' ? 'Aktueller FMH-Durchschnitt' : 'Current FMH average');
  return <section className="card finance-calculator">
    <p className="eyebrow">{text.label}</p>
    <div className="finance-total"><small><GlossaryText locale={locale}>{report.facts.housegeld && includeHousegeld ? text.knownOutlay : text.payment}</GlossaryText></small><strong>{euros(result.knownOutlay)}</strong>{report.facts.housegeld && includeHousegeld ? <em><GlossaryText locale={locale}>{`${euros(result.loanPayment)} ${locale === 'de' ? 'Kredit' : 'loan'} + ${euros(report.facts.housegeld)} Hausgeld`}</GlossaryText></em> : null}</div>
    {report.facts.housegeld ? <label className="housegeld-toggle">
      <input type="checkbox" checked={includeHousegeld} onChange={(event) => setIncludeHousegeld(event.target.checked)} />
      <span><GlossaryText locale={locale}>{`${text.includeHousegeld} · ${euros(report.facts.housegeld)}`}</GlossaryText></span>
    </label> : null}
    <div className="finance-meta">
      <span><GlossaryText locale={locale}>{text.loan}</GlossaryText> <b>{euros(result.loan)}</b></span>
      <span><GlossaryText locale={locale}>{text.purchase}</GlossaryText> <b>{euros(report.facts.price)}</b></span>
      {buyerCosts ? <span><GlossaryText locale={locale}>{buyerCostsAreEstimated ? text.estimatedBuyerCosts : text.buyerCosts}</GlossaryText> <b>{euros(buyerCosts)}</b></span> : null}
      <span><GlossaryText locale={locale}>{text.total}</GlossaryText> <b>{euros(total)}</b></span>
    </div>
    <label>
      <span><span className="finance-field-label"><GlossaryText locale={locale}>{text.equity}</GlossaryText></span><b>{euros(equity)} · {total ? Math.round(equity / total * 100) : 0}%</b></span>
      <input type="range" min="0" max={Math.max(total, 1)} step="1000" value={equity} onChange={(event) => setEquity(Number(event.target.value))} />
    </label>
    <label>
      <span><span className="finance-rate-heading"><GlossaryText locale={locale}>{text.rate}</GlossaryText><a className="finance-rate-source" href={mortgageRate?.sourceUrl || 'https://index.fmh.de/fmh/'} target="_blank" rel="noreferrer">{sourceText} ↗</a></span><b>{interest.toFixed(2)}%</b></span>
      <input type="range" min="2" max="7" step="0.01" value={interest} onChange={(event) => { interestWasEdited.current = true; setInterest(Number(event.target.value)); }} />
    </label>
    <label>
      <span><span className="finance-field-label"><GlossaryText locale={locale}>{text.repayment}</GlossaryText></span><b>{repayment.toFixed(1)}%</b></span>
      <input type="range" min="1" max="5" step="0.1" value={repayment} onChange={(event) => setRepayment(Number(event.target.value))} />
    </label>
    <small className="finance-note"><GlossaryText locale={locale}>{text.note}</GlossaryText></small>
  </section>;
}
