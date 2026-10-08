import type { Locale } from './i18n.ts';

type MethodSection = { heading: string; paragraphs: string[] };
type MethodSource = { label: string; href: string };

type MethodCopy = {
  kicker: string;
  title: string;
  dek: string;
  description: string;
  sections: MethodSection[];
  sourcesLabel: string;
  sources: MethodSource[];
};

const sources: MethodSource[] = [
  { label: 'Gutachterausschuss Berlin, Immobilienmarktbericht 2025/2026', href: 'https://www.berlin.de/gutachterausschuss/_assets/amarktinformationen/amarktanalyse/04-03-010-2500.pdf' },
  { label: 'FMH Index', href: 'https://index.fmh.de/fmh/' },
  { label: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  { label: 'Nominatim', href: 'https://nominatim.org/' },
];

const en: MethodCopy = {
  kicker: 'THE METHOD',
  title: 'How we review',
  dek: 'What the score reads, how the number is built, and what it cannot tell you.',
  description: 'How the Review a House score is built from stated listing facts, official local prices, confidence and the limits of what a listing can show.',
  sourcesLabel: 'SOURCES',
  sources,
  sections: [
    {
      heading: 'What we read',
      paragraphs: [
        'We read the listing you give us: a public link, an Exposé PDF, or text you paste. That is the whole review. We do not buy property data, and we do not log in anywhere. If a portal blocks the import, paste the text or upload the Exposé. Anything absent from the source stays out of the report.',
      ],
    },
    {
      heading: 'How facts are extracted',
      paragraphs: [
        'Rules read the price, living area, rooms, year, floor, energy, Hausgeld and location first. AI only checks those facts against verbatim quotes from the same text. Anything not in the source stays not stated. We never fill a gap with a typical value.',
      ],
    },
    {
      heading: 'The score',
      paragraphs: [
        'Eight parts make a score from 0 to 10: price 25%, neighbourhood 20%, space 15%, building 12%, energy 10%, light 8%, running costs 5%, and how complete the listing is 5%. Price counts only where official local sales prices exist, for now Berlin. 15% or more below the area average scores 8.5; from 5% below to just under 15% below scores 7.5; less than 5% either side scores 6.0; from 5% above to just under 15% above scores 4.5; 15% or more above scores 3.0. Few sales pull that price score halfway towards 6.0. Outside Berlin, price is left out and the other weights are scaled to sum to 1. Yield and buyer costs adjust price only when it is scored.',
        'Confidence counts eight key facts: price, living area, rooms, year, floor, energy class or demand, Hausgeld, and a street or exact address. A house counts floor and Hausgeld as present. A missing fact, or one marked as something to check, does not count. Seven or eight is high, five or six is medium, and four or fewer is low and withholds the score, naming the missing facts. A real contradiction withholds it too and names the fact. Walking time and sun orientation never withhold the score.',
      ],
    },
    {
      heading: 'Data sources',
      paragraphs: [
        // TODO(F03): name the transfer-tax source and the date it was checked once those rates ship. Do not invent a checked-on date before then.
        'Berlin flat prices come from the Gutachterausschuss für Grundstückswerte in Berlin, Immobilienmarktbericht 2025/2026, under the dl-de/zero-2.0 licence. Transfer tax uses the published rates of the federal states. The mortgage illustration starts from the FMH mortgage rate index. Maps use OpenStreetMap and Nominatim.',
      ],
    },
    {
      heading: 'What we can’t know',
      paragraphs: [
        'We cannot know the real condition of the building, the WEG’s finances beyond the listing, legal burdens the listing does not mention, or the final sale price. The score is a screening rubric, not a valuation or a buying recommendation.',
      ],
    },
    {
      heading: 'Independence',
      paragraphs: [
        'We do not take money from sellers or agents in exchange for a ranking. No one can pay for a higher score.',
      ],
    },
  ],
};

const de: MethodCopy = {
  kicker: 'DIE PRÜFUNG',
  title: 'So prüfen wir',
  dek: 'Was der Score liest, wie die Zahl entsteht und was er nicht wissen kann.',
  description: 'Wie der Review-a-House-Score aus den Angaben im Angebot, amtlichen lokalen Preisen und der Verlässlichkeit entsteht, und wo seine Grenze liegt.',
  sourcesLabel: 'QUELLEN',
  sources,
  sections: [
    {
      heading: 'Was wir lesen',
      paragraphs: [
        'Wir lesen das Angebot, das du uns gibst: einen öffentlichen Link, ein Exposé als PDF oder Text, den du einfügst. Das ist die ganze Prüfung. Wir kaufen keine Immobiliendaten und melden uns nirgends an. Blockiert ein Portal den Import, füge den Text ein oder lade das Exposé hoch. Was in der Quelle fehlt, fehlt auch im Bericht.',
      ],
    },
    {
      heading: 'Wie die Angaben entstehen',
      paragraphs: [
        'Regeln lesen zuerst Preis, Wohnfläche, Zimmer, Baujahr, Etage, Energie, Hausgeld und Lage. Eine KI prüft diese Angaben nur gegen wörtliche Zitate aus demselben Text. Was nicht in der Quelle steht, bleibt „nicht angegeben“. Wir füllen keine Lücke mit einem typischen Wert.',
      ],
    },
    {
      heading: 'Der Score',
      paragraphs: [
        'Acht Teile ergeben einen Score von 0 bis 10: Preis 25 %, Lage 20 %, Platz 15 %, Gebäude 12 %, Energie 10 %, Licht 8 %, laufende Kosten 5 % und die Vollständigkeit 5 %. Der Preis zählt nur, wo amtliche lokale Kaufpreise vorliegen, vorerst in Berlin. Mindestens 15 % unter dem Gebietsmittel ergibt 8,5; mindestens 5 % und weniger als 15 % darunter ergibt 7,5; weniger als 5 % nach oben oder unten ergibt 6,0; mindestens 5 % und weniger als 15 % darüber ergibt 4,5; 15 % oder mehr darüber ergibt 3,0. Wenige Verkäufe ziehen den Preisteil zur Hälfte in Richtung 6,0. Außerhalb Berlins entfällt der Preis, und die übrigen Gewichte werden so gestreckt, dass sie wieder 1 ergeben. Rendite und Kaufnebenkosten ändern den Preis nur, wenn er bewertet wird.',
        'Die Verlässlichkeit zählt acht Kernangaben: Preis, Wohnfläche, Zimmer, Baujahr, Etage, Energieklasse oder Energiebedarf, Hausgeld und eine Straße oder genaue Adresse. Bei einem Haus zählen Etage und Hausgeld als vorhanden. Eine fehlende Angabe, oder eine, die als zu prüfen markiert ist, zählt nicht. Sieben oder acht sind hoch, fünf oder sechs mittel, vier oder weniger niedrig, und dann gibt es keinen Score; die fehlenden Angaben werden genannt. Ein echter Widerspruch verhindert ihn ebenfalls und nennt die Angabe. Gehzeit und Sonnenlage verhindern den Score nie.',
      ],
    },
    {
      heading: 'Datenquellen',
      paragraphs: [
        // TODO(F03): name the transfer-tax source and the date it was checked once those rates ship. Do not invent a checked-on date before then.
        'Die Preise für Berliner Eigentumswohnungen stammen aus dem Immobilienmarktbericht 2025/2026 des Gutachterausschusses für Grundstückswerte in Berlin, Lizenz dl-de/zero-2.0. Die Grunderwerbsteuer folgt den veröffentlichten Sätzen der Bundesländer. Die Finanzierungsrechnung startet mit dem FMH-Index für Bauzinsen. Karten nutzen OpenStreetMap und Nominatim.',
      ],
    },
    {
      heading: 'Was wir nicht wissen können',
      paragraphs: [
        'Den wirklichen Zustand des Gebäudes, die Finanzen der WEG über das Angebot hinaus, rechtliche Lasten, die nicht genannt sind, und den Preis, zu dem am Ende verkauft wird, können wir nicht wissen. Der Score ist ein Prüfraster, kein Wertgutachten und keine Kaufempfehlung.',
      ],
    },
    {
      heading: 'Unabhängigkeit',
      paragraphs: [
        'Wir nehmen kein Geld von Verkäufern oder Maklern für eine Platzierung. Einen höheren Score kann niemand kaufen.',
      ],
    },
  ],
};

export function methodCopy(locale: Locale) {
  return locale === 'de' ? de : en;
}

export function methodPlainText(locale: Locale) {
  const page = methodCopy(locale);
  return [page.title, page.dek, ...page.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join('\n');
}
