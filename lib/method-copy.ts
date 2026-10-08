import type { Locale } from './i18n.ts';
import { munichPriceReferenceEnabled } from './price-ref.ts';

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
        'We read the listing you give us: a public link, an Exposé PDF, or text you paste. If a portal blocks the import, paste the text or upload the Exposé.',
      ],
    },
    {
      heading: 'How facts are extracted',
      paragraphs: [
        'Rules read price, living area, rooms, year, floor, energy, Hausgeld and location. A check compares those facts with quotes from the same text. Anything missing stays not stated.',
      ],
    },
    {
      heading: 'The score',
      paragraphs: [
        'Eight parts make a score from 0 to 10: price 25%, neighbourhood 20%, space 15%, building 12%, energy 10%, light 8%, running costs 5%, completeness 5%. Price counts only where official local sales prices exist (Berlin and Cologne by area; the Munich price check is switched off). From 20% under to 50% over: near it about 6, 10% under about 7.5, 10% over about 4.5, 15% over about 3 and 50% over about 1. Few sales pull that halfway towards 6. Elsewhere price is left out, the other weights scale to 1, the header says the price was not checked, and confidence is Medium at most.',
        'Space is area per room plus absolute size, in steps that then hold. Per room: 14 m² is 3.5, 17 m² 5.5, 22 m² 7.7, 32 m² 9.3. A flat: 30 m² is 4, 45 m² 6, 65 m² 7.8, 95 m² 9.2. A house uses 70, 100, 160 and 250 m². Per room counts 55%, size 45%.',
        'Building is 70% condition and 30% year: renovated scores 8, well maintained 7, needs modernisation 4, needs renovation 3. Unknown condition is left out. Leasehold or leased land subtracts 1.5 and caps confidence at Medium. Free within six months subtracts 0.2, with no confidence cap; a fixed end six to 24 months out subtracts 0.4; open-ended subtracts 0.8; 10 years or a Sperrfrist (§ 577a) with an end date still ahead subtracts 1.0. Those three cap at Medium. Only a whole Mehrfamilienhaus or Zinshaus skips that deduction, and confidence stays Medium. A rented flat or house keeps it even as a Kapitalanlage, and the yield is still shown. One class off demand uses the lower class, and High falls only to Medium. Two or more classes apart still withhold the score.',
        'Confidence uses eight key facts: price, living area, rooms, year, floor, energy, Hausgeld and a street. A house counts floor and Hausgeld as present. Seven or eight is High, five or six is Medium. Low means four or fewer key facts, and the score is withheld. A real contradiction withholds it too. Walking time and sun orientation never do.',
      ],
    },
    {
      heading: 'Data sources',
      paragraphs: [
        // TODO(F03): name the transfer-tax source and the date it was checked once those rates ship. Do not invent a checked-on date before then.
        'Berlin: Gutachterausschuss für Grundstückswerte in Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0). Cologne: Gutachterausschuss für Grundstückswerte in der Stadt Köln, Grundstücksmarktbericht 2026 (same licence). The Munich price check is switched off. Postcodes: © OpenStreetMap contributors (ODbL). Transfer tax uses the published rates of the federal states. Mortgages use the FMH index. Maps use OpenStreetMap and Nominatim.',
      ],
    },
    {
      heading: 'What we can’t know',
      paragraphs: [
        'We cannot know the real condition, the WEG’s finances, legal burdens the listing omits, or the final sale price. The score is a screening rubric, not a valuation or a buying recommendation.',
      ],
    },
    {
      heading: 'Independence',
      paragraphs: [
        'We do not take money from sellers or agents for a ranking. No one can pay for a higher score.',
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
        'Regeln lesen Preis, Wohnfläche, Zimmer, Baujahr, Etage, Energie, Hausgeld und Lage. Ein Abgleich prüft sie gegen Zitate aus demselben Text. Was fehlt, bleibt „nicht angegeben“.',
      ],
    },
    {
      heading: 'Der Score',
      paragraphs: [
        'Acht Teile ergeben einen Score von 0 bis 10: Preis 25 %, Lage 20 %, Platz 15 %, Gebäude 12 %, Energie 10 %, Licht 8 %, laufende Kosten 5 %, Vollständigkeit 5 %. Der Preis zählt nur, wo amtliche lokale Kaufpreise vorliegen (Berlin und Köln nach Stadtteil; die München-Preisprüfung ist aus). Von 20 % darunter bis 50 % darüber: nah dran etwa 6, 10 % darunter etwa 7,5, 10 % darüber etwa 4,5, 15 % darüber etwa 3 und 50 % darüber etwa 1. Wenige Verkäufe ziehen den Preisteil zur Hälfte in Richtung 6. Sonst entfällt der Preis, die übrigen Gewichte strecken sich auf 1, der Kopf sagt das, und die Verlässlichkeit bleibt höchstens mittel.',
        'Der Platz ist die Wohnfläche pro Zimmer plus die absolute Größe, in Stufen, die danach stehen bleiben. Pro Zimmer: 14 m² ergibt 3,5, 17 m² 5,5, 22 m² 7,7, 32 m² 9,3. Eine Einheit: 30 m² ergibt 4, 45 m² 6, 65 m² 7,8, 95 m² 9,2. Ein Haus nutzt 70, 100, 160 und 250 m². Pro Zimmer zählt 55 %, die Größe 45 %.',
        'Das Gebäude ist zu 70 % Zustand und zu 30 % Baujahr: renoviert oder saniert ergibt 8, gepflegt 7, modernisierungsbedürftig 4, renovierungsbedürftig 3. Unbekannt zählt nicht. Erbbaurecht oder ein Pachtgrundstück zieht 1,5 ab und deckelt bei mittel. Eine Vermietung zieht 0,2 ab, wenn sie in sechs Monaten endet, ohne Deckel; 0,4 bei festem Ende in sechs bis 24 Monaten; 0,8 unbefristet; 1,0 seit 10 Jahren oder bei einer Sperrfrist (§ 577a), deren Ende noch aussteht. Diese drei deckeln bei mittel. Nur ein Mehrfamilienhaus oder Zinshaus lässt den Abzug aus, bei mittlerer Verlässlichkeit. Eine vermietete Einheit oder ein Haus behält ihn, auch als Kapitalanlage, und die Bruttorendite bleibt sichtbar. Eine Stufe neben dem Bedarf nimmt die schlechtere Klasse, und hoch fällt nur auf mittel. Zwei oder mehr Stufen verhindern ihn weiterhin.',
        'Die Verlässlichkeit nutzt acht Kernangaben: Preis, Wohnfläche, Zimmer, Baujahr, Etage, Energie, Hausgeld und eine Straße. Bei einem Haus zählen Etage und Hausgeld als vorhanden. Sieben oder acht sind hoch, fünf oder sechs mittel. Niedrig heißt vier oder weniger Kernangaben, und dann gibt es keinen Score. Ein echter Widerspruch verhindert ihn ebenfalls. Gehzeit und Sonnenlage verhindern ihn nie.',
      ],
    },
    {
      heading: 'Datenquellen',
      paragraphs: [
        // TODO(F03): name the transfer-tax source and the date it was checked once those rates ship. Do not invent a checked-on date before then.
        'Berlin: Gutachterausschuss für Grundstückswerte in Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0). Köln: Gutachterausschuss für Grundstückswerte in der Stadt Köln, Grundstücksmarktbericht 2026 (gleiche Lizenz). Die München-Preisprüfung ist aus. PLZ: © OpenStreetMap contributors (ODbL). Die Grunderwerbsteuer folgt den veröffentlichten Sätzen der Bundesländer. Finanzierung: FMH-Index. Karten: OpenStreetMap und Nominatim.',
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

const GEOGRAPHY_OFF = {
  en: 'Berlin and Cologne by area; the Munich price check is switched off',
  de: 'Berlin und Köln nach Stadtteil; die München-Preisprüfung ist aus',
};
const GEOGRAPHY_ON = {
  en: 'Berlin and Cologne by area; Munich citywide only, so only clear outliers count',
  de: 'Berlin und Köln nach Gebiet; München nur stadtweit, daher zählen nur deutliche Ausreißer',
};
const MUNICH_SOURCE_OFF = {
  en: 'The Munich price check is switched off.',
  de: 'Die München-Preisprüfung ist aus.',
};
const MUNICH_SOURCE_ON = {
  en: 'Munich is citywide only, so only clear outliers count (Gutachterausschuss München, Halbjahresreport 2026).',
  de: 'München nur stadtweit, daher zählen nur deutliche Ausreißer (Gutachterausschuss München, Halbjahresreport 2026).',
};

export function geographyClause(locale: Locale) {
  return munichPriceReferenceEnabled() ? GEOGRAPHY_ON[locale] : GEOGRAPHY_OFF[locale];
}

function munichAware(text: string, locale: Locale) {
  if (!munichPriceReferenceEnabled()) return text;
  return text.replace(GEOGRAPHY_OFF[locale], GEOGRAPHY_ON[locale]).replace(MUNICH_SOURCE_OFF[locale], MUNICH_SOURCE_ON[locale]);
}

export function methodCopy(locale: Locale): MethodCopy {
  const page = locale === 'de' ? de : en;
  const on = munichPriceReferenceEnabled();
  return {
    ...page,
    sources: on ? page.sources : page.sources.filter((source) => !/Halbjahresreport/.test(source.label)),
    sections: page.sections.map((section) => ({
      ...section,
      paragraphs: section.paragraphs.map((paragraph) => munichAware(paragraph, locale)),
    })),
  };
}

export function methodPlainText(locale: Locale) {
  const page = methodCopy(locale);
  return [page.title, page.dek, ...page.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join('\n');
}
