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
        'Eight parts make a score from 0 to 10: price 25%, neighbourhood 20%, space 15%, building 12%, energy 10%, light 8%, running costs 5%, completeness 5%. Price counts only in Berlin. The gap to the area average runs from 20% under to 50% over: near it about 6, 10% under about 7.5, 10% over about 4.5, and 40% over scores below 15% over. Few sales pull that halfway towards 6. Outside Berlin the price part is left out, the other weights scale to 1, the header says the price was not checked, and confidence is Medium at most.',
        'Building is 70% condition and 30% year: renovated (saniert, renoviert) scores 8, well maintained (gepflegt) 7, needs modernisation 4, needs renovation 3. An unknown condition is left out. Leasehold or leased land subtracts 1.5 and caps confidence at Medium. Free within six months subtracts 0.2, with no confidence cap; a fixed end six to 24 months out subtracts 0.4; open-ended subtracts 0.8; 10 years or an active Sperrfrist (§ 577a) subtracts 1.0. Those three cap at Medium. An apartment building or a Kapitalanlage has no move-in deduction; the header shows the gross yield. One class off demand uses the lower class, and High falls only to Medium. Two or more classes apart still withhold the score.',
        'Confidence uses eight key facts: price, living area, rooms, year, floor, energy, Hausgeld and a street. A house counts floor and Hausgeld as present. Seven or eight is High, five or six is Medium. Low means four or fewer key facts, and the score is withheld. A real contradiction withholds it too. Walking time and sun orientation never do.',
      ],
    },
    {
      heading: 'Data sources',
      paragraphs: [
        // TODO(F03): name the transfer-tax source and the date it was checked once those rates ship. Do not invent a checked-on date before then.
        'Berlin flat prices come from the Gutachterausschuss für Grundstückswerte in Berlin, Immobilienmarktbericht 2025/2026, under the dl-de/zero-2.0 licence. Transfer tax uses the published rates of the federal states. Mortgages use the FMH index. Maps use OpenStreetMap and Nominatim.',
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
        'Wir lesen das Angebot, das du uns gibst: einen öffentlichen Link, ein Exposé als PDF oder Text, den du einfügst. Blockiert ein Portal den Import, füge den Text ein oder lade das Exposé hoch.',
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
        'Acht Teile ergeben einen Score von 0 bis 10: Preis 25 %, Lage 20 %, Platz 15 %, Gebäude 12 %, Energie 10 %, Licht 8 %, laufende Kosten 5 %, Vollständigkeit 5 %. Der Preis zählt nur in Berlin. Der Abstand zum Gebietsmittel läuft von 20 % darunter bis 50 % darüber: nah dran etwa 6, 10 % darunter etwa 7,5, 10 % darüber etwa 4,5, und 40 % darüber liegt unter 15 % darüber. Wenige Verkäufe ziehen den Preisteil zur Hälfte in Richtung 6. Außerhalb Berlins entfällt der Preis, die übrigen Gewichte werden auf 1 gestreckt, der Kopf sagt, dass der Preis nicht geprüft wurde, und die Verlässlichkeit ist höchstens mittel.',
        'Das Gebäude ist zu 70 % Zustand und zu 30 % Baujahr: renoviert oder saniert ergibt 8, gepflegt 7, modernisierungsbedürftig 4, renovierungsbedürftig 3. Erbbaurecht oder ein Pachtgrundstück zieht 1,5 ab und deckelt bei mittel. Eine Vermietung zieht 0,2 ab, wenn sie innerhalb von sechs Monaten endet, und das deckelt nicht; 0,4 bei einem festen Ende in sechs bis 24 Monaten; 0,8 wenn sie unbefristet ist; 1,0 seit 10 Jahren oder bei einer laufenden Sperrfrist (§ 577a). Diese drei deckeln bei mittel. Ein Mehrfamilienhaus oder eine Kapitalanlage hat keinen Einzugsabzug; der Kopf zeigt die Bruttorendite. Eine Stufe neben dem Bedarf zählt die schlechtere Klasse und nimmt hoch nur auf mittel herunter. Zwei oder mehr Stufen verhindern ihn weiterhin.',
        'Die Verlässlichkeit nutzt acht Kernangaben: Preis, Wohnfläche, Zimmer, Baujahr, Etage, Energie, Hausgeld und eine Straße. Bei einem Haus zählen Etage und Hausgeld als vorhanden. Sieben oder acht sind hoch, fünf oder sechs mittel. Niedrig heißt vier oder weniger Kernangaben, und dann gibt es keinen Score. Ein echter Widerspruch verhindert ihn ebenfalls. Gehzeit und Sonnenlage verhindern ihn nie.',
      ],
    },
    {
      heading: 'Datenquellen',
      paragraphs: [
        // TODO(F03): name the transfer-tax source and the date it was checked once those rates ship. Do not invent a checked-on date before then.
        'Die Preise für Berliner Eigentumswohnungen stammen aus dem Immobilienmarktbericht 2025/2026 des Gutachterausschusses für Grundstückswerte in Berlin, Lizenz dl-de/zero-2.0. Die Grunderwerbsteuer folgt den veröffentlichten Sätzen der Bundesländer. Die Finanzierung nutzt den FMH-Index. Karten nutzen OpenStreetMap und Nominatim.',
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
