import { notFound } from 'next/navigation';
import { comparison, report } from '@/lib/store';
import { reportTitle } from '@/lib/display';

const money = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);
const known = (value?: string) => value && !/not stated|unknown/i.test(value) ? value : '—';

export default async function Compare({ params }: { params: Promise<{ id: string }> }) {
  const item = await comparison((await params).id);
  if (!item) notFound();
  const [a, b] = await Promise.all(item.reportIds.map(report));
  if (!a || !b) notFound();
  const row = (label: string, first: string, second: string) => <><div className="metric">{label}</div><div>{first}</div><div>{second}</div></>;

  return <main className="comparison-page">
    <a className="logo" href="/">h <span>habitat</span></a>
    <p className="eyebrow">PROPERTY COMPARISON</p>
    <h1>Two homes, side by side.</h1>
    <p className="lead">A calm view of the facts that change a decision.</p>
    <section className="comparison-grid">
      <div className="metric">PROPERTY</div>
      <div><small>OPTION A</small><h2>{reportTitle(a)}</h2></div>
      <div><small>OPTION B</small><h2>{reportTitle(b)}</h2></div>
      {row('Asking price', money(a.facts.price), money(b.facts.price))}
      {row('Total acquisition cost', money(a.facts.totalCost), money(b.facts.totalCost))}
      {row('Price per living m²', a.facts.area ? money(a.facts.price / a.facts.area) : '—', b.facts.area ? money(b.facts.price / b.facts.area) : '—')}
      {row('Living space', a.facts.area ? `${a.facts.area} m²` : '—', b.facts.area ? `${b.facts.area} m²` : '—')}
      {row('Usable space', a.facts.usableArea ? `${a.facts.usableArea} m²` : '—', b.facts.usableArea ? `${b.facts.usableArea} m²` : '—')}
      {row('Rooms', known(a.facts.rooms), known(b.facts.rooms))}
      {row('Floor', known(a.facts.floor), known(b.facts.floor))}
      {row('Current use', known(a.facts.tenancy), known(b.facts.tenancy))}
      {row('Hausgeld', a.facts.housegeld ? `${money(a.facts.housegeld)} / month` : '—', b.facts.housegeld ? `${money(b.facts.housegeld)} / month` : '—')}
      {row('Advertised return', a.facts.advertisedYield ? `${a.facts.advertisedYield}%` : '—', b.facts.advertisedYield ? `${b.facts.advertisedYield}%` : '—')}
      {row('Energy', `${known(a.facts.energy)}${a.facts.energySource ? ` · ${a.facts.energySource}` : ''}`, `${known(b.facts.energy)}${b.facts.energySource ? ` · ${b.facts.energySource}` : ''}`)}
      {row('Data confidence', `${a.score.toFixed(1)} / 10`, `${b.score.toFixed(1)} / 10`)}
    </section>
  </main>;
}
