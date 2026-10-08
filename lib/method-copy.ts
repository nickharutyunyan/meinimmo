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
        'We read the listing you give us: a public link, an Exposé PDF, or text you paste. If a portal blocks the import, paste the text or upload the Exposé. Anything absent from the source stays out.',
      ],
    },
    {
      heading: 'How facts are extracted',
      paragraphs: [
        'Rules read price, living area, rooms, year, floor, energy, Hausgeld and location first. AI only checks those facts against quotes from the same text. Anything missing stays not stated.',
      ],
    },
    {
      heading: 'The score',
      paragraphs: [
        'Eight parts make a score from 0 to 10: price 25%, neighbourhood 20%, space 15%, building 12%, energy 10%, light 8%, running costs 5%, and how complete the listing is 5%. Price counts only in Berlin. 15% or more below the area average scores 8.5; 5% to just under 15% below scores 7.5; within 5% scores 6.0; 5% to just under 15% above scores 4.5; 15% or more above scores 3.0. Few sales pull that halfway towards 6.0. Outside Berlin the price part is left out, the other weights scale to 1, the header says the price was not checked, and confidence is Medium at most.',
        'Building is 70% condition and 30% year: renovated (saniert, renoviert) scores 8, well maintained (gepflegt) 7, needs modernisation 4, needs renovation 3. An unknown condition is left out. Leasehold or leased land subtracts 1.5. A rented home subtracts 0.8 for a buyer who wants to move in. Either caps confidence at Medium. A listed building and a required garage are notes only. An energy class one step off demand uses the lower class and lowers confidence one step; the score stays. Two or more classes apart still withhold it.',
        'Confidence uses eight key facts: price, living area, rooms, year, floor, energy, Hausgeld and a street. A house counts floor and Hausgeld as present. Seven or eight is high, five or six is medium, and four or fewer withholds the score and names the gaps. A real contradiction withholds it too. Walking time and sun orientation never do.',
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
        'Wir lesen das Angebot, das du uns gibst: einen öffentlichen Link, ein Exposé als PDF oder Text, den du einfügst. Blockiert ein Portal den Import, füge den Text ein oder lade das Exposé hoch.',
      ],
    },
    {
      heading: 'Wie die Angaben entstehen',
      paragraphs: [
        'Regeln lesen zuerst Preis, Wohnfläche, Zimmer, Baujahr, Etage, Energie, Hausgeld und Lage. Eine KI prüft diese Angaben nur gegen Zitate aus demselben Text. Was fehlt, bleibt „nicht angegeben“.',
      ],
    },
    {
      heading: 'Der Score',
      paragraphs: [
        'Acht Teile ergeben einen Score von 0 bis 10: Preis 25 %, Lage 20 %, Platz 15 %, Gebäude 12 %, Energie 10 %, Licht 8 %, laufende Kosten 5 % und die Vollständigkeit 5 %. Der Preis zählt nur in Berlin. Mindestens 15 % unter dem Gebietsmittel ergibt 8,5; mindestens 5 % und weniger als 15 % darunter ergibt 7,5; weniger als 5 % Abweichung ergibt 6,0; mindestens 5 % und weniger als 15 % darüber ergibt 4,5; 15 % oder mehr darüber ergibt 3,0. Wenige Verkäufe ziehen den Preisteil zur Hälfte in Richtung 6,0. Außerhalb Berlins entfällt der Preis, die übrigen Gewichte werden auf 1 gestreckt, der Kopf sagt, dass der Preis nicht geprüft wurde, und die Verlässlichkeit ist höchstens mittel.',
        'Das Gebäude ist zu 70 % Zustand und zu 30 % Baujahr: renoviert oder saniert ergibt 8, gepflegt 7, modernisierungsbedürftig 4, renovierungsbedürftig 3. Einen unbekannten Zustand lassen wir weg. Erbbaurecht oder ein Pachtgrundstück zieht 1,5 ab. Eine vermietete Wohnung zieht 0,8 ab, für Käufer, die selbst einziehen wollen. Beides deckelt die Verlässlichkeit bei mittel. Denkmalschutz und ein Pflichtkauf von Garage oder Stellplatz sind nur Hinweise. Weicht die Energieklasse eine Stufe vom Bedarf ab, zählt die schlechtere Klasse und die Verlässlichkeit sinkt um eine Stufe; der Score bleibt. Zwei oder mehr Stufen verhindern ihn weiter.',
        'Die Verlässlichkeit nutzt acht Kernangaben: Preis, Wohnfläche, Zimmer, Baujahr, Etage, Energie, Hausgeld und eine Straße. Bei einem Haus zählen Etage und Hausgeld als vorhanden. Sieben oder acht sind hoch, fünf oder sechs mittel, vier oder weniger verhindern den Score. Ein echter Widerspruch verhindert ihn ebenfalls. Gehzeit und Sonnenlage verhindern ihn nie.',
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
        'Den wirklichen Zustand, die Finanzen der WEG, ungenannte Lasten und den späteren Verkaufspreis können wir nicht wissen. Der Score ist ein Prüfraster, kein Wertgutachten und keine Kaufempfehlung.',
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
