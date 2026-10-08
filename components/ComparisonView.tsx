import { localizedWarnings } from '@/lib/report-copy';
import { displayedPropertyScore, scoreAvailable, scoreExplanation } from '@/lib/report-integrity';
import { Fragment } from 'react';
import Link from 'next/link';
import type { Report } from '@/lib/types';
import { reportSubtitle, reportTitle, resolveLocation } from '@/lib/display';
import { neighborhoodForReport } from '@/lib/geocode';
import { formatScore, priceUnscoredLabel } from '@/lib/property-score';
import { copy, localePath, localizedTenancy, localizedValue, type Locale } from '@/lib/i18n';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';
import { ComparisonShareButton } from './ComparisonShareButton';
import { visibleComparisonRows } from '@/lib/comparison';
import { redFlagSummary } from '@/lib/red-flags';
import { localizedTaxonomyValue } from '@/lib/property-taxonomy';
import { priceCheckCompare } from '@/lib/price-check-copy';
import { area, money, moneyPerSqm, percent } from '@/lib/format';

function scoreCell(item: Report, total: number, locale: Locale) {
  if (!scoreAvailable(item)) return '—';
  return `${formatScore(total, locale)} / 10`;
}

export async function ComparisonView({ first, second, locale }: { first: Report; second: Report; locale: Locale }) {
  const text = copy[locale].compare;
  const firstScore = displayedPropertyScore(first);
  const secondScore = displayedPropertyScore(second);
  const [firstNeighborhood, secondNeighborhood] = await Promise.all([
    neighborhoodForReport(first),
    neighborhoodForReport(second),
  ]);
  const known = (value?: string) => localizedValue(value, locale) === copy[locale].report.notDisclosed ? '—' : localizedValue(value, locale);
  const energy = (item: Report) => {
    const energyClass = known(item.facts.energy);
    const source = item.facts.energySource ? localizedValue(item.facts.energySource, locale) : '';
    const parts = [...(energyClass === '—' ? [] : [energyClass]), ...(source && source !== copy[locale].report.notDisclosed ? [source] : [])];
    return parts.length ? parts.join(' · ') : '—';
  };
  const tenancy = (item: Report) => item.facts.tenancy || item.facts.availabilityDate
    ? localizedTenancy(item.facts.tenancy, item.facts.availabilityDate, locale)
    : '—';
  const address = (item: Report) => {
    const location = resolveLocation(item);
    return ['address', 'street', 'postal code'].includes(location.basis) ? reportSubtitle(item) || '—' : '—';
  };
  const mapsUrl = (item: Report) => {
    const query = resolveLocation(item).mapQuery;
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '';
  };
  const addressLinks = [mapsUrl(first), mapsUrl(second)] as const;
  const comparisonValue = (label: string, value: string, valueIndex: 1 | 2) => {
    const mapsHref = label === text.address && value !== '—' ? addressLinks[valueIndex - 1] : '';
    return mapsHref
      ? <a className="comparison-address-link" href={mapsHref} target="_blank" rel="noreferrer" aria-label={`${value} — Google Maps`}><GlossaryText locale={locale}>{value}</GlossaryText><span aria-hidden="true">↗</span></a>
      : <GlossaryText locale={locale}>{value}</GlossaryText>;
  };
  const housegeld = (item: Report) => item.facts.housegeld ? `${money(item.facts.housegeld, locale)} ${text.monthly}${item.facts.housegeldYear ? ` (${item.facts.housegeldYear})` : ''}` : '—';
  const amount = (value?: number) => value ? money(value, locale) : '—';
  const space = (value?: number) => value ? area(value, locale) : '—';
  const rows = visibleComparisonRows([
    [text.address, address(first), address(second)],
    [text.neighborhood, firstNeighborhood || '—', secondNeighborhood || '—'],
    [text.asking, amount(first.facts.price), amount(second.facts.price)],
    [text.acquisition, amount(first.facts.totalCost), amount(second.facts.totalCost)],
    [locale === 'de' ? 'Garage/Stellplatz separat (nicht enthalten)' : 'Parking quoted separately (excluded)', amount(first.facts.parkingPrice), amount(second.facts.parkingPrice)],
    [text.commission, first.facts.buyerCommission ? known(first.facts.buyerCommission) : '—', second.facts.buyerCommission ? known(second.facts.buyerCommission) : '—'],
    [text.perSqm, first.facts.price && first.facts.area ? moneyPerSqm(first.facts.price / first.facts.area, locale) : '—', second.facts.price && second.facts.area ? moneyPerSqm(second.facts.price / second.facts.area, locale) : '—'],
    [priceCheckCompare(first, locale).label, priceCheckCompare(first, locale).value, priceCheckCompare(second, locale).value],
    [text.living, space(first.facts.area), space(second.facts.area)],
    [text.usable, space(first.facts.usableArea), space(second.facts.usableArea)],
    [text.rooms, known(first.facts.rooms), known(second.facts.rooms)],
    [text.floor, known(first.facts.floor), known(second.facts.floor)],
    [locale === 'de' ? 'Tageslicht' : 'Daylight', localizedTaxonomyValue(first, 'daylight', locale) || '—', localizedTaxonomyValue(second, 'daylight', locale) || '—'],
    [locale === 'de' ? 'Ausrichtung' : 'Orientation', localizedTaxonomyValue(first, 'orientation', locale) || '—', localizedTaxonomyValue(second, 'orientation', locale) || '—'],
    [text.use, tenancy(first), tenancy(second)],
    [text.condition, known(first.facts.condition), known(second.facts.condition)],
    [text.redFlags, redFlagSummary(first, locale), redFlagSummary(second, locale)],
    [text.housegeld, housegeld(first), housegeld(second)],
    [text.return, first.facts.advertisedYield ? percent(first.facts.advertisedYield, locale) : '—', second.facts.advertisedYield ? percent(second.facts.advertisedYield, locale) : '—'],
    [text.energy, energy(first), energy(second)],
    [copy[locale].report.notes, localizedWarnings(first, locale).join(' ') || '—', localizedWarnings(second, locale).join(' ') || '—'],
    [text.score, scoreCell(first, firstScore.total, locale), scoreCell(second, secondScore.total, locale)],
  ] as const);

  const mixesPriceCheck = (firstScore.breakdown.price === null) !== (secondScore.breakdown.price === null);
  const priceNotes = [first, second].flatMap((item, index) => {
    const score = index === 0 ? firstScore : secondScore;
    if (score.breakdown.price !== null) return [];
    const option = index === 0 ? 'A' : 'B';
    return [`${text.option} ${option}: ${copy[locale].report.components.price} — ${priceUnscoredLabel(item, locale)}`];
  });
  const lowNotes = [first, second].flatMap((item, index) => {
    if (scoreAvailable(item)) return [];
    const option = index === 0 ? 'A' : 'B';
    return [`${text.option} ${option}: ${scoreExplanation(item, locale)}`];
  });

  return <main className="comparison-page" lang={locale}>
    <SiteNav locale={locale} />
    <div className="comparison-kicker"><p className="eyebrow">{text.label}</p><ComparisonShareButton locale={locale} /></div>
    <h1>{text.title}</h1>
    <div className="comparison-table-scroll"><section className="comparison-grid">
      <div className="metric">{text.property}</div>
      <div><small>{text.option} A</small><h2><a href={localePath(locale, `/r/${first.id}`)}>{reportTitle(first, locale)}</a></h2></div>
      <div><small>{text.option} B</small><h2><a href={localePath(locale, `/r/${second.id}`)}>{reportTitle(second, locale)}</a></h2></div>
      {rows.map(([label, a, b]) => <Fragment key={label}><div className="metric"><GlossaryText locale={locale}>{label}</GlossaryText></div><div>{comparisonValue(label, a, 1)}</div><div>{comparisonValue(label, b, 2)}</div></Fragment>)}
    </section></div>
    <section className="comparison-mobile" aria-label={text.title}>{[[first, 'A', 1], [second, 'B', 2]].map(([item, option, valueIndex]) => {
      const property = item as Report;
      return <article key={String(option)}><small>{text.option} {String(option)}</small><h2><a href={localePath(locale, `/r/${property.id}`)}>{reportTitle(property, locale)}</a></h2><dl>{rows.map(([label, a, b]) => <div key={label}><dt><GlossaryText locale={locale}>{label}</GlossaryText></dt><dd>{comparisonValue(label, valueIndex === 1 ? a : b, valueIndex as 1 | 2)}</dd></div>)}</dl></article>;
    })}</section>
    <p className="finance-note">{copy[locale].report.scoreExplainer} <Link href={localePath(locale, '/method')}>{copy[locale].report.howWeReview}</Link></p>
    {mixesPriceCheck ? <p className="finance-note">{text.mixedPrice}</p> : null}
    {priceNotes.length ? <p className="finance-note">{priceNotes.join(' · ')}</p> : null}
    {lowNotes.length ? <p className="finance-note">{lowNotes.join(' · ')}</p> : null}
    <SiteFooter locale={locale} />
  </main>;
}
