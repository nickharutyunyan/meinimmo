'use client';

import { useMemo, useState } from 'react';
import type { Report } from '@/lib/types';

const euros = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);

export function FinanceCalculator({ report }: { report: Report }) {
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

  return <section className="card finance-calculator">
    <p className="eyebrow">FINANCING SCENARIO</p>
    <div className="finance-total"><small>{report.facts.housegeld ? 'Known monthly outlay before rent' : 'Illustrative loan payment'}</small><strong>{euros(result.knownOutlay)}</strong>{report.facts.housegeld ? <em>{euros(result.loanPayment)} loan + {euros(report.facts.housegeld)} Hausgeld</em> : null}</div>
    <div className="finance-meta">
      <span>Loan <b>{euros(result.loan)}</b></span>
      <span>Purchase price <b>{euros(report.facts.price)}</b></span>
      {report.facts.buyerCosts ? <span>Buyer costs <b>{euros(report.facts.buyerCosts)}</b></span> : null}
      <span>Total cost <b>{euros(total)}</b></span>
    </div>
    <label>
      <span>Equity / down payment <b>{euros(equity)} · {total ? Math.round(equity / total * 100) : 0}%</b></span>
      <input type="range" min="0" max={Math.max(total, 1)} step="1000" value={equity} onChange={(event) => setEquity(Number(event.target.value))} />
    </label>
    <label>
      <span>Mortgage rate <b>{interest.toFixed(1)}%</b></span>
      <input type="range" min="2" max="7" step="0.1" value={interest} onChange={(event) => setInterest(Number(event.target.value))} />
    </label>
    <label>
      <span>Initial repayment (Tilgung) <b>{repayment.toFixed(1)}%</b></span>
      <input type="range" min="1" max="5" step="0.1" value={repayment} onChange={(event) => setRepayment(Number(event.target.value))} />
    </label>
    <small className="finance-note">Illustrative annuity calculation, not a financing offer. Hausgeld is shown gross; for a rented unit, verify the recoverable and owner-only portions. Confirm the rate, buyer-cost assumptions and affordability with a lender.</small>
  </section>;
}
