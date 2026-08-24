'use client';

import { useEffect } from 'react';
import type { Report } from '@/lib/types';
import { displayAddress, factualLocation, reportTitle } from '@/lib/display';
import { FinanceCalculator } from './FinanceCalculator';
import { LocationCard } from './LocationCard';
import { OfferQuestions } from './OfferQuestions';
import { Sidebar } from './Sidebar';

const euros = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);

export function ReportView({ report }: { report: Report }) {
  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem('habitat-history') || '[]') as string[];
    if (!ids.includes(report.id)) {
      ids.push(report.id);
      localStorage.setItem('habitat-history', JSON.stringify(ids.slice(-20)));
      window.dispatchEvent(new Event('habitat-history-changed'));
    }
  }, [report.id]);

  const facts = report.facts;
  const areaLabel = factualLocation(report);
  const cleanAddress = displayAddress(report.address);
  const subtitle = /not stated/i.test(cleanAddress) ? areaLabel : cleanAddress;
  const mapLabel = areaLabel || cleanAddress.replace(/,?\s*\d{5}\s+[A-ZÄÖÜ][\p{L}äöüß-]+$/u, '');
  const mapQuery = /not stated/i.test(cleanAddress) ? `${areaLabel}, Germany` : `${cleanAddress}, Germany`;
  const glance = [
    ['Asking price', euros(facts.price)],
    ['Price per m²', facts.area ? euros(facts.price / facts.area) : 'Not stated'],
    ['Living space', facts.area ? `${facts.area} m²` : 'Not stated'],
    ['Rooms', facts.rooms],
    ['Floor', facts.floor],
    ['Sun / orientation', report.sunOrientation],
    ['Energy', facts.energy],
    ['Heating', facts.heating],
    ['Built', facts.year],
  ];

  return <>
    <Sidebar />
    <main className="workspace">
      <header className="report-head">
        <div><p className="eyebrow">PROPERTY ASSESSMENT</p><h1>{reportTitle(report)}</h1>{subtitle && <p>{subtitle}</p>}</div>
        <button onClick={() => navigator.clipboard.writeText(location.href)}>↗ Share report</button>
      </header>

      <section className="verdict">
        <div><small>HABITAT VIEW</small><strong>{report.score.toFixed(1)}<i>/10</i></strong></div>
        <div><h2>{report.score >= 7.5 ? 'A considered yes—if the details check out.' : 'Worth a closer look before committing.'}</h2><p>{report.summary}</p></div>
      </section>

      <div className="report-grid">
        <div>
          <section className="card"><p className="eyebrow">AT A GLANCE</p><div className="facts">{glance.map(([key, value]) => <div key={key}><small>{key}</small><b>{value}</b></div>)}</div></section>
          <section className="card"><p className="eyebrow">WHAT MATTERS</p>{report.considerations.map((item, index) => <div className="signal" key={item}><span>{index === 0 ? '↑' : '!'}</span><p>{item}</p></div>)}</section>
          <LocationCard query={mapQuery} label={mapLabel} />
        </div>
        <aside>
          <FinanceCalculator report={report} />
          <OfferQuestions report={report} />
          <section className="card source"><p className="eyebrow">SOURCE</p>{report.source.startsWith('http') ? <a href={report.source} target="_blank" rel="noreferrer">View original listing ↗</a> : <p>{report.source}</p>}<small>Assessment saved · {new Date(report.createdAt).toLocaleDateString('en-GB')}</small></section>
        </aside>
      </div>

      <section className="plans">
        <div><p className="eyebrow">ASSESS MORE</p><h2>Keep the decision process moving.</h2><p>Two assessments per day are free. Upgrade when you are actively searching.</p></div>
        <article><span>PRO</span><strong>€10<small>/month</small></strong><p>10 assessments per day</p><button>Upgrade to Pro</button></article>
        <article className="ultra"><span>ULTRA</span><strong>€20<small>/month</small></strong><p>100 assessments per day</p><button>Choose Ultra</button></article>
      </section>
    </main>
  </>;
}
