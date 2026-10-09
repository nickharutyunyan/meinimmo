import type { Listing } from './types.ts';
import { areaLabel, conditionLabel, floorLabel, priceLabel } from './format.ts';
import { featureLabel } from './features.ts';

type Locale = 'en' | 'de';
type Draft = Pick<Listing, 'propertyType' | 'facts' | 'address'>;

function number(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 }).format(value);
}

function placeName(address: Draft['address']) {
  return address.district || address.city || '';
}

/** A plain, factual headline. The seller can replace it in one click. */
export function generatedTitle(listing: Draft, locale: Locale) {
  const { facts, propertyType } = listing;
  const place = placeName(listing.address);
  const where = place ? (locale === 'de' ? ` in ${place}` : ` in ${place}`) : '';
  const rooms = facts.rooms ? number(facts.rooms, locale) : '';
  if (propertyType === 'land') {
    const plot = areaLabel(facts.plotArea, locale);
    if (locale === 'de') return `Grundstück${plot ? ` mit ${plot}` : ''}${where}`;
    return `${plot ? `${plot} plot` : 'Building plot'}${where}`;
  }
  if (propertyType === 'house') {
    if (locale === 'de') return `${rooms ? `${rooms}-Zimmer-Haus` : 'Haus'}${where}`;
    return `${rooms ? `${rooms}-room house` : 'House'}${where}`;
  }
  if (locale === 'de') {
    if (rooms) return `${rooms}-Zimmer-Wohnung${where}`;
    return `${facts.area ? `${areaLabel(facts.area, 'de')} ` : ''}Wohnung${where}`;
  }
  if (rooms) return `${rooms}-room flat${where}`;
  return `${facts.area ? `${areaLabel(facts.area, 'en')} ` : ''}Flat${where}`.replace(/^(\d.*m²) Flat/, '$1 flat');
}

function sentence(parts: Array<string | false | undefined | null>) {
  const text = parts.filter(Boolean).join('');
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}

/**
 * Short paragraphs built only from the facts on the listing. Nothing is invented,
 * so the seller starts from a correct draft and adds the character of the home.
 */
export function generatedDescription(listing: Draft, locale: Locale) {
  const { facts, propertyType, address } = listing;
  const place = [address.district, address.city].filter((value, index, all) => value && all.indexOf(value) === index).join(', ');
  const floor = floorLabel(facts.floor, locale);
  const condition = conditionLabel(facts.condition, locale);
  const features = facts.features.map(key => featureLabel(key, locale));
  const paragraphs: string[] = [];

  if (locale === 'de') {
    const kind = propertyType === 'house' ? 'Haus' : propertyType === 'land' ? 'Grundstück' : 'Wohnung';
    if (propertyType === 'land') {
      paragraphs.push(sentence([`${kind}`, facts.plotArea ? ` mit ${areaLabel(facts.plotArea, 'de')}` : '', place ? ` in ${place}` : '', '.']));
    } else {
      paragraphs.push(sentence([
        facts.rooms ? `${number(facts.rooms, 'de')}-Zimmer-${kind}` : kind,
        facts.area ? ` mit ${areaLabel(facts.area, 'de')} Wohnfläche` : '',
        floor && propertyType === 'flat' ? `, ${floor}` : '',
        facts.plotArea && propertyType === 'house' ? ` auf ${areaLabel(facts.plotArea, 'de')} Grundstück` : '',
        place ? ` in ${place}` : '',
        '.',
      ]));
    }
    const building = [facts.year && `Baujahr ${facts.year}`, condition && `Zustand: ${condition}`].filter(Boolean).join(', ');
    if (building) paragraphs.push(`${building}.`);
    const running = [
      facts.energyClass && `Energieklasse ${facts.energyClass}`,
      facts.heating && facts.heating,
      facts.housegeld && `Hausgeld ${priceLabel(facts.housegeld, 'de')} im Monat`,
    ].filter(Boolean).join(' · ');
    if (running) paragraphs.push(`${running}.`);
    if (features.length) paragraphs.push(`Ausstattung: ${features.join(', ')}.`);
    if (facts.availableFrom) paragraphs.push(`Verfügbar ab ${facts.availableFrom}.`);
    return paragraphs.join('\n\n');
  }

  const kind = propertyType === 'house' ? 'house' : propertyType === 'land' ? 'plot' : 'flat';
  if (propertyType === 'land') {
    paragraphs.push(sentence([facts.plotArea ? `a ${areaLabel(facts.plotArea, 'en')} building plot` : 'a building plot', place ? ` in ${place}` : '', '.']));
  } else {
    paragraphs.push(sentence([
      facts.rooms ? `a ${number(facts.rooms, 'en')}-room ${kind}` : `a ${kind}`,
      facts.area ? ` with ${areaLabel(facts.area, 'en')} of living space` : '',
      floor && propertyType === 'flat' ? `, ${/floor$/i.test(floor) ? `on the ${floor.toLowerCase()}` : floor.toLowerCase()}` : '',
      facts.plotArea && propertyType === 'house' ? ` on a ${areaLabel(facts.plotArea, 'en')} plot` : '',
      place ? ` in ${place}` : '',
      '.',
    ]));
  }
  const building = [facts.year && `built in ${facts.year}`, condition && condition.toLowerCase()].filter(Boolean).join(', ');
  if (building) paragraphs.push(sentence([building, '.']));
  const running = [
    facts.energyClass && `Energy class ${facts.energyClass}`,
    facts.heating && facts.heating,
    facts.housegeld && `Hausgeld ${priceLabel(facts.housegeld, 'en')} a month`,
  ].filter(Boolean).join(' · ');
  if (running) paragraphs.push(`${running}.`);
  if (features.length) paragraphs.push(`Features: ${features.join(', ')}.`);
  if (facts.availableFrom) paragraphs.push(`Available from ${facts.availableFrom}.`);
  return paragraphs.join('\n\n');
}
