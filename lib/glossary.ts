import type { Locale } from './i18n';

const glossary = [
  { terms: ['Instandhaltungsrücklage', 'WEG-Rücklage', 'WEG reserve'], explanation: "The condominium owners' shared maintenance reserve." },
  { terms: ['Wohnungseigentümergemeinschaft', 'WEG'], explanation: "The condominium owners' association responsible for the shared building." },
  { terms: ['Sonderumlagen', 'Sonderumlage'], explanation: 'A one-off special payment charged to owners for exceptional building costs.' },
  { terms: ['Teilungserklärung'], explanation: 'The declaration of division defining private ownership, shared property and use rights.' },
  { terms: ['Wirtschaftsplan'], explanation: "The condominium owners' association's annual budget and cost plan." },
  { terms: ['Nettokaltmiete'], explanation: 'Net rent excluding service charges, heating and utilities.' },
  { terms: ['Kaltmiete'], explanation: 'Rent excluding service charges, heating and utilities.' },
  { terms: ['Energieausweis'], explanation: 'The statutory energy performance certificate for the building.' },
  { terms: ['Verbrauchsausweis'], explanation: 'An energy certificate based mainly on the building’s recorded energy consumption.' },
  { terms: ['Bedarfsausweis'], explanation: 'An energy certificate based on a calculated assessment of the building and heating system.' },
  { terms: ['Hausgeld'], explanation: 'The monthly condominium fee covering shared running costs and reserve contributions.' },
  { terms: ['Kaufnebenkosten'], explanation: 'Ancillary purchase costs such as transfer tax, notary, land register and possibly agent fees.' },
  { terms: ['Dienstbarkeiten', 'Dienstbarkeit'], explanation: 'A registered easement granting another party a defined right over the property.' },
  { terms: ['Baulasten', 'Baulast'], explanation: 'A public-law building obligation recorded against the property.' },
  { terms: ['Mietspiegel'], explanation: 'The local reference rent index used to assess typical rents.' },
  { terms: ['nicht umlagefähige', 'nicht umlagefähig'], explanation: 'Owner costs that cannot be passed on to a tenant.' },
  { terms: ['umlagefähige', 'umlagefähig'], explanation: 'Running costs that may generally be passed on to a tenant, subject to the lease and law.' },
  { terms: ['Gemeinschaftseigentum'], explanation: 'Parts of a condominium building owned jointly by all unit owners.' },
  { terms: ['Sondereigentum'], explanation: 'The privately owned unit and other areas assigned exclusively to one owner.' },
  { terms: ['Grunderwerbsteuer'], explanation: 'Property transfer tax payable by the buyer.' },
  { terms: ['Erbbaurecht'], explanation: 'A long-term leasehold right to own or use a building on land owned by someone else.' },
  { terms: ['Grundbuch'], explanation: 'The official land register recording ownership and registered rights.' },
  { terms: ['Sollzins'], explanation: 'The stated borrowing interest rate before fees and other costs.' },
  { terms: ['Tilgung'], explanation: 'The part of a mortgage payment that repays the loan principal.' },
  { terms: ['Exposés', 'Exposé'], explanation: 'The property listing brochure or sales particulars.' },
] as const;

const definitions = new Map(glossary.flatMap(entry => entry.terms.map(term => [term.toLocaleLowerCase('de-DE'), entry.explanation] as const)));
const matcher = new RegExp(`(${[...definitions.keys()].sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu');

export type GlossaryPiece = { text: string; explanation?: string };

export function glossaryPieces(text: string, locale: Locale): GlossaryPiece[] {
  if (locale !== 'en') return [{ text }];
  return text.split(matcher).filter(Boolean).map(piece => ({
    text: piece,
    explanation: definitions.get(piece.toLocaleLowerCase('de-DE')),
  }));
}
