'use client';
import { useEffect, useState } from 'react';
import { amd, monthlyPayment } from '@/lib/countries';
import { AM_MORTGAGE_URL, type ArmeniaRate } from '@/lib/armenia-finance';

export function ArmeniaFinance({ price, land = false }: { price: number; land?: boolean }) {
  const [deposit, setDeposit] = useState(20); const [years, setYears] = useState(20);
  const [rate, setRate] = useState<number | null>(null); const [benchmark, setBenchmark] = useState<ArmeniaRate | null>(null);
  const [loaded, setLoaded] = useState(false); const [costs, setCosts] = useState('');
  useEffect(() => {
    if (land) { setLoaded(true); return; }
    let active = true;
    fetch('/api/armenia/market', { cache: 'no-store' }).then(r => r.json() as Promise<{ mortgage?: ArmeniaRate }>).then((data) => {
      if (!active) return;
      if (data.mortgage) { setBenchmark(data.mortgage); setRate(current => current ?? data.mortgage!.rate); }
    }).catch(() => undefined).finally(() => active && setLoaded(true));
    return () => { active = false; };
  }, [land]);
  const loan = price * (1 - deposit / 100);
  const payment = rate === null ? null : monthlyPayment(loan, rate, years);
  return <section className="am-finance"><p className="eyebrow">{land ? 'Land purchase budget' : 'Financing scenario'} · AMD</p><h2>{land ? 'Start with the full cost.' : 'Make the numbers yours.'}</h2>
    {!land ? <><div className="am-monthly"><strong>{payment === null ? '—' : amd(payment)}</strong><span>per month · principal + interest</span></div>
      <label className="am-slider"><span>Down payment <b>{deposit}%</b></span><input aria-label="Down payment percentage" type="range" min="0" max="100" step="1" value={deposit} onChange={e => setDeposit(Number(e.target.value))}/><small>{amd(price * deposit / 100)}</small></label>
      <label className="am-rate-input"><span>Annual nominal rate (%)</span><input aria-label="Annual nominal rate" type="number" min="0" max="35" step="0.05" value={rate ?? ''} placeholder={loaded ? 'Enter a bank quote' : 'Loading…'} onChange={e => setRate(e.target.value === '' ? null : Math.min(35, Math.max(0, Number(e.target.value))))}/></label>
      <p className="am-rate-source"><a href={benchmark?.sourceUrl || AM_MORTGAGE_URL} target="_blank" rel="noreferrer">Acba mortgage example ↗</a>{benchmark ? ` · ${benchmark.rate}% · checked ${benchmark.checkedAt.slice(0, 10)}${benchmark.stale ? ' · last saved quote; refresh unavailable' : ''}` : loaded ? ' · live quote unavailable; enter your own rate' : ' · checking published quote'}</p>
      <label className="am-slider"><span>Loan term <b>{years} years</b></span><input aria-label="Loan term in years" type="range" min="1" max="30" value={years} onChange={e => setYears(Number(e.target.value))}/></label>
      <dl><div><dt>Loan amount</dt><dd>{amd(loan)}</dd></div><div><dt>Total interest over term</dt><dd>{payment === null ? '—' : amd(Math.max(0, payment * years * 12 - loan))}</dd></div></dl>
      <p className="am-finance-note">Lender example, not a national average or a financing offer. Equal monthly payments assume an unchanged rate for the whole term; the lender’s actual rate may float. Insurance, bank fees, tax relief and ownership costs are not included.</p></> : <p>Residential mortgage terms are not assumed for land. Ask a lender whether this plot and its permitted use qualify.</p>}
    <label className="am-rate-input"><span>Other purchase / works costs (AMD)</span><input aria-label="Other purchase costs AMD" type="number" min="0" max="1000000000000" step="10000" value={costs} placeholder="Enter your estimate" onChange={e => setCosts(e.target.value)}/></label>
    <dl><div><dt>Price + entered costs</dt><dd>{amd(price + Math.max(0, Number(costs) || 0))}</dd></div></dl><p className="am-finance-note">Add verified notary, registration, appraisal, broker and renovation or connection costs here. A blank field means costs have not been estimated, not that they are zero.</p>
  </section>;
}
