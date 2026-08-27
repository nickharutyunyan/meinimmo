import { Fragment } from 'react';
import type { Report } from '@/lib/types';
import { reportSubtitle, reportTitle, resolveLocation } from '@/lib/display';
import { neighborhoodForReport } from '@/lib/geocode';
import { calculatePropertyScore } from '@/lib/property-score';
import { copy, localizedValue, type Locale } from '@/lib/i18n';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';
import { ComparisonShareButton } from './ComparisonShareButton';
import { visibleComparisonRows } from '@/lib/comparison';

const money = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);

export async function ComparisonView({ first, second, locale }: { first: Report; second: Report; locale: Locale }) {
  const text = copy[locale].compare;
  const firstScore = calculatePropertyScore(first);
  const secondScore = calculatePropertyScore(second);
  const [firstNeighborhood, secondNeighborhood] = await Promise.all([
    neighborhoodForReport(first),
    neighborhoodForReport(second),
  ]);
  const known = (value?: string) => localizedValue(value, locale) === copy[locale].report.notDisclosed ? '—' : localizedValue(value, locale);
  const energy = (item: Report) => {
    const energyClass = known(item.facts.energy);
    const parts = [...(energyClass === '—' ? [] : [energyClass]), ...(item.facts.energySource ? [item.facts.energySource] : [])];
    return parts.length ? parts.join(' · ') : '—';
  };
  const address = (item: Report) => {
    const location = resolveLocation(item);
    return ['address', 'street', 'postal code'].includes(location.basis) ? reportSubtitle(item) || '—' : '—';
  };
  const rows = visibleComparisonRows([
    [text.address, address(first), address(second)],
    [text.neighborhood, firstNeighborhood || '—', secondNeighborhood || '—'],
    [text.asking, first.facts.price ? money(first.facts.price) : '—', second.facts.price ? money(second.facts.price) : '—'],
    [text.acquisition, first.facts.totalCost ? money(first.facts.totalCost) : '—', second.facts.totalCost ? money(second.facts.totalCost) : '—'],
    [text.commission, first.facts.buyerCommission ? known(first.facts.buyerCommission) : '—', second.facts.buyerCommission ? known(second.facts.buyerCommission) : '—'],
    [text.perSqm, first.facts.area ? money(first.facts.price / first.facts.area) : '—', second.facts.area ? money(second.facts.price / second.facts.area) : '—'],
    [text.living, first.facts.area ? `${first.facts.area} m²` : '—', second.facts.area ? `${second.facts.area} m²` : '—'],
    [text.usable, first.facts.usableArea ? `${first.facts.usableArea} m²` : '—', second.facts.usableArea ? `${second.facts.usableArea} m²` : '—'],
    [text.rooms, known(first.facts.rooms), known(second.facts.rooms)],
    [text.floor, known(first.facts.floor), known(second.facts.floor)],
    [text.use, known(first.facts.tenancy), known(second.facts.tenancy)],
    [text.condition, known(first.facts.condition), known(second.facts.condition)],
    [text.housegeld, first.facts.housegeld ? `${money(first.facts.housegeld)} ${text.monthly}` : '—', second.facts.housegeld ? `${money(second.facts.housegeld)} ${text.monthly}` : '—'],
    [text.return, first.facts.advertisedYield ? `${first.facts.advertisedYield}%` : '—', second.facts.advertisedYield ? `${second.facts.advertisedYield}%` : '—'],
    [text.energy, energy(first), energy(second)],
    [text.score, `${firstScore.total.toFixed(2)} / 10`, `${secondScore.total.toFixed(2)} / 10`],
  ] as const);

  return <main className="comparison-page" lang={locale}>
    <SiteNav locale={locale} />
    <div className="comparison-kicker"><p className="eyebrow">{text.label}</p><ComparisonShareButton locale={locale} /></div>
    <h1>{text.title}</h1>
    <p className="lead">{text.intro}</p>
    <div className="comparison-table-scroll"><section className="comparison-grid">
      <div className="metric">{text.property}</div>
      <div><small>{text.option} A</small><h2>{reportTitle(first, locale)}</h2></div>
      <div><small>{text.option} B</small><h2>{reportTitle(second, locale)}</h2></div>
      {rows.map(([label, a, b]) => <Fragment key={label}><div className="metric"><GlossaryText locale={locale}>{label}</GlossaryText></div><div><GlossaryText locale={locale}>{a}</GlossaryText></div><div><GlossaryText locale={locale}>{b}</GlossaryText></div></Fragment>)}
    </section></div>
    <section className="comparison-mobile" aria-label={text.title}>{[[first, 'A', 1], [second, 'B', 2]].map(([item, option, valueIndex]) => {
      const property = item as Report;
      return <article key={String(option)}><small>{text.option} {String(option)}</small><h2>{reportTitle(property, locale)}</h2><dl>{rows.map(([label, a, b]) => <div key={label}><dt><GlossaryText locale={locale}>{label}</GlossaryText></dt><dd><GlossaryText locale={locale}>{valueIndex === 1 ? a : b}</GlossaryText></dd></div>)}</dl></article>;
    })}</section>
    <SiteFooter locale={locale} />
  </main>;
}
