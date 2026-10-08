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
  { label: 'Gutachterausschuss für Grundstückswerte in der Stadt Köln, Grundstücksmarktbericht 2026', href: 'https://gars.nrw/images/user/GA_K%C3%B6ln/GMB2026_Digitalversion.pdf' },
  { label: 'Gutachterausschuss München, Halbjahresreport 2026', href: 'https://stadt.muenchen.de/dam/jcr%3A1ab1829c-2c44-4fdc-b03b-6646c7849fab/Halbjahresreport_2026.pdf' },
  { label: 'FMH Index', href: 'https://index.fmh.de/fmh/' },
  { label: '© OpenStreetMap contributors (ODbL)', href: 'https://www.openstreetmap.org/copyright' },
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
        'We read the listing you give us: a public link, an Exposé PDF, or pasted text. If a portal blocks the import, paste the text. Anything absent stays out.',
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
        'Eight parts make a score from 0 to 10: price 25%, neighbourhood 20%, space 15%, building 12%, energy 10%, light 8%, running costs 5% and completeness 5%. Price counts only where official local sales prices exist (Berlin and Cologne by area; Munich citywide only, so only clear outliers count). 15% or more below an area average scores 8.5; 5% to just under 15% below scores 7.5; within 5% scores 6.0; 5% to just under 15% above scores 4.5; 15% or more above scores 3.0. Few sales pull that halfway towards 6.0. Elsewhere price is left out, other weights scale to 1, and confidence is Medium at most.',
        'Building is 70% condition and 30% year: renovated scores 8, well maintained 7, needs modernisation 4, needs renovation 3. An unknown condition is left out. Leasehold subtracts 1.5 and a rented home subtracts 0.8; either caps confidence at Medium. A listed building and a required garage are notes only. An energy class one step off demand uses the lower class and lowers confidence one step. Two or more classes apart still withhold the score.',
        'Confidence uses eight key facts: price, living area, rooms, year, floor, energy, Hausgeld and a street. A house counts floor and Hausgeld as present. Seven or eight is high, five or six medium, and four or fewer withholds the score. A contradiction withholds it too. Walking time and sun orientation never do.',
      ],
    },
    {
      heading: 'Data sources',
      paragraphs: [
        // TODO(F03): name the transfer-tax source and the date it was checked once those rates ship. Do not invent a checked-on date before then.
        'Berlin flat prices come from the Gutachterausschuss für Grundstückswerte in Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0). Cologne flat prices come from the Gutachterausschuss für Grundstückswerte in der Stadt Köln, Grundstücksmarktbericht 2026 (same licence). Munich figures from the Gutachterausschuss München, Halbjahresreport 2026, stay off until the licence is confirmed. Postcodes map with © OpenStreetMap contributors (ODbL). Transfer tax uses the published rates of the federal states. The mortgage illustration starts from the FMH index. Maps use OpenStreetMap and Nominatim.',
      ],
    },
    {
      heading: 'What we can’t know',
      paragraphs: [
        'We cannot know the real condition, the WEG’s finances, unmentioned legal burdens, or the final sale price. The score is a screening rubric, not a valuation or a buying recommendation.',
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
        'Wir lesen das Angebot, das du uns gibst: einen öffentlichen Link, ein Exposé als PDF oder eingefügten Text. Blockiert ein Portal den Import, füge den Text ein.',
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
        'Acht Teile ergeben einen Score von 0 bis 10: Preis 25 %, Lage 20 %, Platz 15 %, Gebäude 12 %, Energie 10 %, Licht 8 %, laufende Kosten 5 % und Vollständigkeit 5 %. Der Preis zählt nur, wo amtliche lokale Kaufpreise vorliegen (Berlin und Köln nach Gebiet; München nur stadtweit, daher zählen nur deutliche Ausreißer). Mindestens 15 % unter dem Gebietsmittel ergibt 8,5; mindestens 5 % und weniger als 15 % darunter ergibt 7,5; weniger als 5 % Abweichung ergibt 6,0; mindestens 5 % und weniger als 15 % darüber ergibt 4,5; 15 % oder mehr darüber ergibt 3,0. Wenige Verkäufe ziehen den Preisteil zur Hälfte in Richtung 6,0. Sonst entfällt der Preis, die übrigen Gewichte werden auf 1 gestreckt und die Verlässlichkeit ist höchstens mittel.',
        'Das Gebäude ist zu 70 % Zustand und zu 30 % Baujahr: renoviert ergibt 8, gepflegt 7, modernisierungsbedürftig 4, renovierungsbedürftig 3. Einen unbekannten Zustand lassen wir weg. Erbbaurecht zieht 1,5 ab, eine vermietete Wohnung 0,8; beides deckelt die Verlässlichkeit bei mittel. Denkmalschutz und ein Pflichtkauf von Garage oder Stellplatz sind nur Hinweise. Weicht die Energieklasse eine Stufe vom Bedarf ab, zählt die schlechtere Klasse und die Verlässlichkeit sinkt um eine Stufe. Zwei oder mehr Stufen verhindern den Score.',
        'Die Verlässlichkeit nutzt acht Kernangaben: Preis, Wohnfläche, Zimmer, Baujahr, Etage, Energie, Hausgeld und eine Straße. Bei einem Haus zählen Etage und Hausgeld als vorhanden. Sieben oder acht sind hoch, fünf oder sechs mittel, vier oder weniger verhindern den Score. Ein Widerspruch verhindert ihn ebenfalls. Gehzeit und Sonnenlage zählen nie.',
      ],
    },
    {
      heading: 'Datenquellen',
      paragraphs: [
        // TODO(F03): name the transfer-tax source and the date it was checked once those rates ship. Do not invent a checked-on date before then.
        'Berliner Wohnungspreise stammen aus dem Immobilienmarktbericht 2025/2026 des Gutachterausschusses für Grundstückswerte in Berlin (dl-de/zero-2.0). Kölner Preise stammen aus dem Grundstücksmarktbericht 2026 des Gutachterausschusses für Grundstückswerte in der Stadt Köln (gleiche Lizenz). Münchner Werte aus dem Halbjahresreport 2026 des Gutachterausschusses München bleiben aus, bis die Lizenz bestätigt ist. PLZ-Zuordnung: © OpenStreetMap contributors (ODbL). Die Grunderwerbsteuer folgt den veröffentlichten Sätzen der Bundesländer. Die Finanzierungsrechnung startet mit dem FMH-Index. Karten nutzen OpenStreetMap und Nominatim.',
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
