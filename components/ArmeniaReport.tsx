'use client';
import { useEffect, useState } from 'react';
import type { Report } from '@/lib/types';
import { amd, mapsLink } from '@/lib/countries';
import { SiteNav } from './SiteNav';
import { Sidebar } from './Sidebar';
import { SiteFooter } from './SiteFooter';
import { ArmeniaFinance } from './ArmeniaFinance';
import { ReportNote } from './ReportNote';

export function ArmeniaReport({ report }: { report: Report }) {
  const am = report.armenia!; const f = report.facts; const land = report.propertyType === 'land';
  const [copied, setCopied] = useState(false); const [place, setPlace] = useState<{lat:number;lon:number} | null>(null);
  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem('habitat-history') || '[]') as string[];
    if (!ids.includes(report.id)) localStorage.setItem('habitat-history', JSON.stringify([...ids, report.id].slice(-30)));
    window.dispatchEvent(new Event('habitat-history-changed'));
    let active = true;
    fetch(`/api/geocode?q=${encodeURIComponent(`${report.address}, Armenia`)}&country=AM`).then(r => r.ok ? r.json() as Promise<{lat:number;lon:number}> : null).then(data => active && setPlace(data)).catch(() => undefined);
    return () => { active = false; };
  }, [report.id, report.address]);
  const rows = [
    ['Asking price', amd(f.price)], [land ? 'Plot size' : 'Advertised area', `${f.area} m²`],
    ...(!land ? [['Rooms', f.rooms], ['Floor', f.floor ? `${f.floor}${am.buildingFloors ? ` / ${am.buildingFloors}` : ''}` : ''], ['Living area', am.livingArea ? `${am.livingArea} m²` : ''], ['New building', am.newConstruction === undefined ? '' : am.newConstruction ? 'Yes' : 'No'], ['Construction', am.construction], ['Renovation', am.renovation === 'None' ? 'Not renovated' : am.renovation], ['Building state', f.condition], ['Occupancy', f.tenancy], ['Elevator', am.elevator], ['Balcony', am.balcony]] : [['Advertised land use', am.landUse], ['Road access', am.roadAccess]]),
    ['Plot area', !land && am.plotArea ? `${am.plotArea} m²` : ''], ['Utilities', am.utilities], ['Neighborhood', f.district],
  ].filter(([, value]) => value);
  return <><Sidebar locale="en" homeHref="/am"/><main className="workspace am-report">
    <SiteNav locale="en" country="AM"/>
    <header className="am-report-heading"><div><p className="eyebrow">Armenia property report · Prototype</p><h1>{report.title}</h1><a className="report-address-link" href={mapsLink(report.address)} target="_blank" rel="noreferrer">{report.address} ↗</a></div><button className="share-button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setCopied(false); } }}>{copied ? '✓ Link copied' : '↗ Copy share link'}</button></header>
    <section className="am-summary">{report.summary.split('\n\n').map(p => <p key={p}>{p}</p>)}</section>
    <div className="am-report-grid"><div><section className="card"><p className="eyebrow">At a glance</p><dl className="am-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {am.fx && <p className="am-source-note">Original asking price: {am.originalPrice.toLocaleString('en-GB')} {am.originalCurrency}{am.priceBasis === 'per-m2' ? ' per m²' : ''}. <a href={am.fx.sourceUrl} target="_blank" rel="noreferrer">CBA conversion ↗</a>: 1 {am.originalCurrency} = {am.fx.rate} AMD, {am.fx.date}. Bank conversion charges and exchange-rate movements may change the amount.</p>}
      <p className="am-source-note">Unstated details are omitted. No German energy grade or deal score is applied to Armenian properties.</p></section>
      <section className="card"><p className="eyebrow">Questions worth asking</p><ol className="am-questions">{report.offerQuestions?.map(q => <li key={q}>{q}</li>)}</ol></section>
      <section className="card"><p className="eyebrow">Location</p><h2><a className="report-address-link" href={mapsLink(report.address)} target="_blank" rel="noreferrer">{report.address} ↗</a></h2><p className="am-source-note">{am.approximate ? 'Approximate area: the exact address was not disclosed.' : 'Address as stated by the seller; location has not been independently verified.'}</p>
        {place ? <iframe className="am-map" title={`Area map: ${report.address}`} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${place.lon-.012},${place.lat-.007},${place.lon+.012},${place.lat+.007}&layer=mapnik`}/> : <p className="am-source-note">Use the Google Maps link to explore the stated location.</p>}
      </section><ReportNote reportId={report.id} locale="en"/>
      {am.importMethod === 'pdf' && !report.sourceFile && <p className="am-source-note">The PDF was read to create this report. Original-file storage is not available, so keep your own copy; a download is not retained here.</p>}
      <section className="card"><p className="eyebrow">Source</p>{report.sourceFile ? <a href={`/api/reports/${report.id}/source`}>{report.sourceFile.displayName} ↓</a> : /^https:\/\//.test(report.source) ? <a href={report.source} target="_blank" rel="noreferrer">View original listing ↗</a> : <span>{report.source}</span>}<p className="am-source-note">{am.importMethod === 'text' ? 'Based on pasted listing text' : am.importMethod === 'browser' ? 'Based on browser-provided listing text' : am.importMethod === 'pdf' ? 'Exposé PDF' : 'Imported listing'} · Report saved {report.createdAt.slice(0,10)}{am.sourceUpdated ? ` · Listing renewed ${am.sourceUpdated}` : ''}</p><details><summary>Extracted source facts</summary><dl className="am-evidence">{Object.entries(am.evidence).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details></section>
    </div><ArmeniaFinance price={f.price} land={land}/></div><SiteFooter locale="en"/>
  </main></>;
}
