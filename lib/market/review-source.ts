import type { Listing } from './types.ts';
import { FEATURES, isFeatureKey } from './features.ts';
import { displayDescription, displayTitle } from './validate.ts';

const GERMAN_CONDITION: Record<string, string> = {
  'renovated': 'saniert',
  'well maintained': 'gepflegt',
  'like new': 'neuwertig',
  'erstbezug': 'Erstbezug',
  'new build': 'Neubau',
  'needs modernisation': 'modernisierungsbedürftig',
  'needs renovation': 'renovierungsbedürftig',
};

function germanNumber(value: number) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value);
}

/**
 * Writes a seller listing in the labelled German layout the listing parser reads,
 * so the seller's own offer gets the same review as any imported listing.
 */
export function listingAsSourceText(listing: Listing) {
  const { facts, address } = listing;
  const kind = listing.propertyType === 'house' ? 'Haus kaufen' : listing.propertyType === 'land' ? 'Grundstück kaufen' : 'Wohnung kaufen';
  const place = [address.street, [address.postalCode, address.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const lines = [
    displayTitle(listing, 'de'),
    kind,
    facts.price ? `Kaufpreis: ${germanNumber(facts.price)} €` : '',
    facts.area ? `Wohnfläche: ${germanNumber(facts.area)} m²` : '',
    facts.plotArea ? `Grundstücksfläche: ${germanNumber(facts.plotArea)} m²` : '',
    facts.rooms ? `Zimmer: ${germanNumber(facts.rooms)}` : '',
    facts.floor ? `Etage: ${facts.floor}` : '',
    facts.year ? `Baujahr: ${facts.year}` : '',
    facts.condition ? `Zustand: ${GERMAN_CONDITION[facts.condition.toLowerCase()] || facts.condition}` : '',
    facts.energyClass ? `Energieeffizienzklasse: ${facts.energyClass}` : '',
    facts.heating ? `Heizungsart: ${facts.heating}` : '',
    facts.housegeld ? `Hausgeld: ${germanNumber(facts.housegeld)} €` : '',
    facts.features.length ? `Ausstattung: ${facts.features.map(key => isFeatureKey(key) ? FEATURES[key].de : key).join(', ')}` : '',
    facts.availableFrom ? `Verfügbar ab: ${facts.availableFrom}` : '',
    place ? `Adresse: ${place}${address.district ? ` (${address.district})` : ''}` : '',
    'Provisionsfrei, Verkauf direkt vom Eigentümer.',
    'Beschreibung',
    displayDescription(listing, 'de'),
  ];
  return lines.filter(Boolean).join('\n');
}
