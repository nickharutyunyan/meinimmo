'use client';

import { useMemo, useState } from 'react';
import type { Report } from '@/lib/types';
import { copy, type Locale } from '@/lib/i18n';

const euros = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);

export function FinanceCalculator({ report, locale }: { report: Report; locale: Locale }) {
  const total = report.facts.totalCost || report.facts.price;
  const initialEquity = Math.min(total, Math.round(total * 0.25 / 1000) * 1000);
  const [equity, setEquity] = useState(initialEquity);
  const [interest, setInterest] = useState(3.5);
  const [repayment, setRepayment] = useState(2);
  const result = useMemo(() => {
    const loan = Math.max(0, total - equity);
    const loanPayment = loan * (interest + repayment) / 100 / 12;
    return { loan, loanPayment, knownOutlay: loanPayment + (report.facts.housegeld || 0) };
  }, [equity, interest, repayment, report.facts.housegeld, total]);

  const text = copy[locale].finance;
  return <section className="card finance-calculator">
    <p className="eyebrow">{text.label}</p>
    <div className="finance-total"><small>{report.facts.housegeld ? text.knownOutlay : text.payment}</small><strong>{euros(result.knownOutlay)}</strong>{report.facts.housegeld ? <em>{euros(result.loanPayment)} {locale === 'de' ? 'Kredit' : 'loan'} + {euros(report.facts.housegeld)} Hausgeld</em> : null}</div>
    <div className="finance-meta">
      <span>{text.loan} <b>{euros(result.loan)}</b></span>
      <span>{text.purchase} <b>{euros(report.facts.price)}</b></span>
      {report.facts.buyerCosts ? <span>{text.buyerCosts} <b>{euros(report.facts.buyerCosts)}</b></span> : null}
      <span>{text.total} <b>{euros(total)}</b></span>
    </div>
    <label>
      <span>{text.equity} <b>{euros(equity)} · {total ? Math.round(equity / total * 100) : 0}%</b></span>
      <input type="range" min="0" max={Math.max(total, 1)} step="1000" value={equity} onChange={(event) => setEquity(Number(event.target.value))} />
    </label>
    <label>
      <span>{text.rate} <b>{interest.toFixed(1)}%</b></span>
      <input type="range" min="2" max="7" step="0.1" value={interest} onChange={(event) => setInterest(Number(event.target.value))} />
    </label>
    <label>
      <span>{text.repayment} <b>{repayment.toFixed(1)}%</b></span>
      <input type="range" min="1" max="5" step="0.1" value={repayment} onChange={(event) => setRepayment(Number(event.target.value))} />
    </label>
    <small className="finance-note">{text.note}</small>
  </section>;
}
