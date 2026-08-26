import type { Report } from '@/lib/types';
import { reportSubtitle, reportTitle } from '@/lib/display';
import { calculatePropertyScore } from '@/lib/property-score';
import { copy, localizedValue, type Locale } from '@/lib/i18n';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';

const money = (number: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);

export function ComparisonView({ first, second, locale }: { first: Report; second: Report; locale: Locale }) {
  const text = copy[locale].compare;
  const firstScore = calculatePropertyScore(first);
  const secondScore = calculatePropertyScore(second);
  const known = (value?: string) => localizedValue(value, locale) === copy[locale].report.notDisclosed ? '—' : localizedValue(value, locale);
  const row = (label: string, a: string, b: string) => <><div className="metric"><GlossaryText locale={locale}>{label}</GlossaryText></div><div><GlossaryText locale={locale}>{a}</GlossaryText></div><div><GlossaryText locale={locale}>{b}</GlossaryText></div></>;

  return <main className="comparison-page" lang={locale}>
    <SiteNav locale={locale} />
    <p className="eyebrow">{text.label}</p>
    <h1>{text.title}</h1>
    <p className="lead">{text.intro}</p>
    <div className="comparison-table-scroll"><section className="comparison-grid">
      <div className="metric">{text.property}</div>
      <div><small>{text.option} A</small><h2>{reportTitle(first, locale)}</h2><p>{reportSubtitle(first)}</p></div>
      <div><small>{text.option} B</small><h2>{reportTitle(second, locale)}</h2><p>{reportSubtitle(second)}</p></div>
      {row(text.asking, money(first.facts.price), money(second.facts.price))}
      {row(text.acquisition, first.facts.totalCost ? money(first.facts.totalCost) : '—', second.facts.totalCost ? money(second.facts.totalCost) : '—')}
      {row(text.perSqm, first.facts.area ? money(first.facts.price / first.facts.area) : '—', second.facts.area ? money(second.facts.price / second.facts.area) : '—')}
      {row(text.living, first.facts.area ? `${first.facts.area} m²` : '—', second.facts.area ? `${second.facts.area} m²` : '—')}
      {row(text.usable, first.facts.usableArea ? `${first.facts.usableArea} m²` : '—', second.facts.usableArea ? `${second.facts.usableArea} m²` : '—')}
      {row(text.rooms, known(first.facts.rooms), known(second.facts.rooms))}
      {row(text.floor, known(first.facts.floor), known(second.facts.floor))}
      {row(text.use, known(first.facts.tenancy), known(second.facts.tenancy))}
      {row(text.condition, known(first.facts.condition), known(second.facts.condition))}
      {row(text.housegeld, first.facts.housegeld ? `${money(first.facts.housegeld)} ${text.monthly}` : '—', second.facts.housegeld ? `${money(second.facts.housegeld)} ${text.monthly}` : '—')}
      {row(text.return, first.facts.advertisedYield ? `${first.facts.advertisedYield}%` : '—', second.facts.advertisedYield ? `${second.facts.advertisedYield}%` : '—')}
      {row(text.energy, `${known(first.facts.energy)}${first.facts.energySource ? ` · ${first.facts.energySource}` : ''}`, `${known(second.facts.energy)}${second.facts.energySource ? ` · ${second.facts.energySource}` : ''}`)}
      {row(text.score, `${firstScore.total.toFixed(2)} / 10`, `${secondScore.total.toFixed(2)} / 10`)}
    </section></div>
    <SiteFooter locale={locale} />
  </main>;
}
