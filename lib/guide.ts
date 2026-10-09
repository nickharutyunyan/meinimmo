import type { Locale } from './i18n';

export type GuidePlace = { name: string; detail: string; query?: string };
export type GuideSection = {
  heading: string;
  paragraphs: string[];
  googleMaps?: { query: string; label: string };
  stops?: GuidePlace[];
  map?: { query: string; label: string; lat: number; lon: number; places: GuidePlace[] };
};
export type GuideSource = { label: string; href: string };
export type GuideArticleCopy = {
  kicker: string;
  title: string;
  dek: string;
  readTime: string;
  photoLabel: string;
  sections: GuideSection[];
  sources: GuideSource[];
};
export type GuideArticle = {
  slug: string;
  published: string;
  accent: 'clay' | 'green' | 'blue';
  en: GuideArticleCopy;
  de: GuideArticleCopy;
};

const investmentSources: GuideSource[] = [
  { label: 'Destatis house-price index', href: 'https://www.destatis.de/EN/Themes/Economy/Prices/Construction-Prices-And-Real-Property-Prices/Tables/House-price-index-building-land.html' },
  { label: 'City of Erfurt: rail connections', href: 'https://www.erfurt.de/ef/de/erleben/anreise/bahn/' },
  { label: 'City of Erfurt: ICE City development', href: 'https://www.erfurt.de/ef/de/leben/planen/stadtplanung/ip_tk/ice_city/' },
  { label: 'Deutsche Bahn: ICE Sprinter network', href: 'https://www.bahn.de/service/ueber-uns/zugtypen/ice-sprinter' },
  { label: 'Zughafen Erfurt', href: 'https://zughafen.de/' },
  { label: 'Franz Mehlhose Erfurt', href: 'https://franz-mehlhose.de/' },
];

const familySources: GuideSource[] = [
  { label: 'Berlin: Prenzlauer Berg family neighbourhoods', href: 'https://www.berlin.de/special/stadtteile/prenzlauer-berg/920613-5170843-prenzlauer-berg-familienkieze-im-nordwes.html' },
  { label: 'Friedenau district profile', href: 'https://www.berlin.de/ba-tempelhof-schoeneberg/politik-und-verwaltung/service-und-organisationseinheiten/koordination-und-beteiligung/bezirksregionen/bzrp_073005-1305939.php' },
  { label: 'Seepark playground reopening', href: 'https://www.berlin.de/ba-lichtenberg/aktuelles/nachrichten/artikel.1449474.php' },
  { label: 'Berlin school directory: Seepark primary school', href: 'https://www.bildung.berlin.de/Schulverzeichnis/Schulportrait.aspx?IDSchulzweig=29800' },
  { label: 'MACHmit! Museum', href: 'https://machmitmuseum.de/' },
  { label: 'Lula am Markt', href: 'https://www.lula-berlin.de/de' },
  { label: 'Café TreBo', href: 'https://www.cafetrebo.de/' },
];

const streetSources: GuideSource[] = [
  { label: 'Berlin: Kantstraße neighbourhood walk', href: 'https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/spazieren-und-wandern/kiezspaziergaenge/artikel.1513590.php' },
  { label: 'Berlin: Kantstraße food scene', href: 'https://www.berlin.de/restaurants/kieze/10207987-3804422-gastroszene-in-der-kantstrasse.html' },
  { label: 'Schwarzes Café', href: 'https://schwarzescafe-berlin.de/' },
  { label: 'Munich Kunstareal', href: 'https://www.pinakothek-der-moderne.de/kunstareal/' },
  { label: 'Türkentor', href: 'https://www.pinakothek.de/de/tuerkentor' },
  { label: 'Café Puck', href: 'https://cafe-puck.de/' },
  { label: 'Hamburg: Sternschanze portrait', href: 'https://www.hamburg.de/leben-in-hamburg/bezirke-hamburg/stadtteile-bezirk-altona/sternschanze-371180' },
  { label: 'Rote Flora', href: 'https://www.rote-flora.de/kontakt/' },
  { label: 'elbgold Schanze', href: 'https://elbgold.com/' },
  { label: 'Blattgold', href: 'https://www.blattgold.hamburg/' },
  { label: 'Cologne Tourism: Körnerstraße', href: 'https://www.koelntourismus.de/kunst-kultur/sehenswuerdigkeiten/detail/koernerstrasse' },
  { label: 'Van Dyck Ehrenfeld', href: 'https://vandyckkaffee.de/standorte/' },
  { label: 'Café Sehnsucht', href: 'https://sehnsucht-koeln.de/' },
  { label: 'Frankfurt Tourism: Braubachstraße', href: 'https://www.visitfrankfurt.travel/poi/braubachstrasse' },
  { label: 'IIMORI Pâtisserie', href: 'https://iimori.de/' },
  { label: 'MUSEUM MMK visitor information', href: 'https://www.mmk.art/de/visit/museum' },
];

const marketSources: GuideSource[] = [
  { label: 'Gutachterausschuss Berlin: market reports', href: 'https://www.berlin.de/gutachterausschuss/' },
  { label: 'BORIS.NRW: Cologne market reports', href: 'https://www.boris.nrw.de/' },
  { label: 'Gutachterausschuss München', href: 'https://stadt.muenchen.de/infos/gutachterausschuss.html' },
  { label: 'Review a House: how the price check works', href: '/method' },
];

const energySources: GuideSource[] = [
  { label: 'GEG § 80: when which certificate is required', href: 'https://www.gesetze-im-internet.de/geg/__80.html' },
  { label: 'GEG § 82: consumption certificates', href: 'https://www.gesetze-im-internet.de/geg/__82.html' },
  { label: 'GEG § 87: what an advert must state', href: 'https://www.gesetze-im-internet.de/geg/__87.html' },
  { label: 'GEG Annex 10: efficiency classes', href: 'https://www.gesetze-im-internet.de/geg/anlage_10.html' },
];

const hausgeldSources: GuideSource[] = [
  { label: 'WEG § 19: the reserve as part of proper management', href: 'https://www.gesetze-im-internet.de/woeigg/__19.html' },
  { label: 'WEG § 24: the record of resolutions', href: 'https://www.gesetze-im-internet.de/woeigg/__24.html' },
  { label: 'WEG § 28: budget, annual statement, asset report', href: 'https://www.gesetze-im-internet.de/woeigg/__28.html' },
  { label: 'BetrKV § 2: operating costs a landlord may pass on', href: 'https://www.gesetze-im-internet.de/betrkv/__2.html' },
];

const newArticles: GuideArticle[] = [
  {
    slug: 'sixty-listings-three-cities',
    published: '2026-10-09',
    accent: 'green',
    en: {
      kicker: 'Our data · Berlin, Munich, Cologne',
      title: 'Sixty private listings, three cities, one honest read',
      dek: 'We reviewed the 60 newest flats and houses that private owners put up for sale in Berlin, Munich and Cologne. The averages matter less than the spread.',
      readTime: '6 min read',
      photoLabel: '60 listings · 9 October 2026',
      sections: [
        {
          heading: 'What we looked at',
          paragraphs: [
            'On 9 October 2026 we took the 20 newest sale listings that private sellers had posted on a large German for-sale-by-owner portal in each city: Berlin limited to Prenzlauer Berg, Schöneberg and Charlottenburg, Munich and Cologne citywide. Every one now has its own page and a free review on Review a House.',
            'Twenty homes per city is a snapshot, not a census. These are asking prices from owners who sell without an agent, so “commission-free” is true of all 60 by design. Read the numbers as the shape of what is on offer this week, not as the market.',
          ],
        },
        {
          heading: 'Berlin: the median says fair, the range says check every flat',
          paragraphs: [
            'Against the Gutachterausschuss averages for 2025 resales in the same district, the median Berlin listing asks 5% more. That sounds unremarkable until you look at the spread: from 45% below the district average to 44% above it, all inside three districts.',
            'Prenzlauer Berg shows it most clearly. Six of its listings ask between €7,263 and €8,591 per m² against a district average of €6,300, while others sit at €4,584 and €3,491. Same district, same year of data, more than double the price per square metre. Floor, condition, a lift, a balcony and whether the flat is rented explain much of it; the district name explains very little.',
            'Half of the Berlin flats were built in 1918 or earlier. Only one dates from 2000 or later. If you want a new build in these districts, the private market barely has one.',
          ],
        },
        {
          heading: 'Munich: higher scores, for a reason worth knowing',
          paragraphs: [
            'Munich listings have the highest median review score of the three cities, 7.9 out of 10 against 6.7 in Berlin and 6.3 in Cologne. Do not read that as better value.',
            'Munich’s official reference is a city-wide figure, not one per district, so our price check stays switched off there and the price part is left out of the score. A score without price measures the home, not the deal. With a median asking price of €8,929 per m², the deal is the hard part.',
            'The Munich homes are also younger: none was built before 1960, five in 2000 or later, and six of the 20 carry energy class A. Gardens (11 of 20) and lifts (10 of 20) are far more common than in Berlin.',
          ],
        },
        {
          heading: 'Cologne: almost half are already rented',
          paragraphs: [
            'Nine of the 20 Cologne homes are sold with a tenant in place, against three in Berlin and two in Munich. For an owner-occupier that changes everything: the date you can move in depends on the tenancy, not on the notary.',
            'Where we can compare with the Cologne Gutachterausschuss figures for 2025, the median listing asks 18% above its Stadtteil average. Several of those Stadtteile record only 10 to 34 sales a year, so a single sale moves their average; our review lowers its confidence in exactly those cases.',
          ],
        },
        {
          heading: 'A third leave out the energy class',
          paragraphs: [
            '19 of the 60 listings do not state an energy efficiency class. Where a certificate exists when the advert is placed, § 87 of the Buildings Energy Act (GEG) asks a commercial advert to state its type, the energy figure, the main heating fuel, the year of construction and the class. Private sellers on a portal are not always held to that, so the gap is common.',
            'Ask for the certificate before a viewing. The seller must show it at the latest during the viewing anyway, and its absence on the advert is usually an oversight rather than a secret. It is, however, worth knowing which of the two certificate types you are looking at; the next article explains why.',
          ],
        },
        {
          heading: 'What to take from this',
          paragraphs: [
            'Ignore the city average and look at the flat. In all three cities the spread within one district is wider than the difference between districts.',
            'Every one of these 60 homes has a review that puts its asking price next to the official figures for its area, where those exist. Open two side by side, and the price gap usually has a reason you can see in the listing.',
          ],
        },
      ],
      sources: marketSources,
    },
    de: {
      kicker: 'Unsere Daten · Berlin, München, Köln',
      title: 'Sechzig Privatangebote, drei Städte, ein ehrlicher Blick',
      dek: 'Wir haben die 60 neuesten Wohnungen und Häuser geprüft, die private Eigentümer in Berlin, München und Köln anbieten. Wichtiger als der Durchschnitt ist die Streuung.',
      readTime: '6 Min. Lesezeit',
      photoLabel: '60 Angebote · 9. Oktober 2026',
      sections: [
        {
          heading: 'Was wir angeschaut haben',
          paragraphs: [
            'Am 9. Oktober 2026 haben wir je Stadt die 20 neuesten Kaufangebote privater Verkäufer von einem großen deutschen Portal für Privatverkäufe übernommen: in Berlin aus Prenzlauer Berg, Schöneberg und Charlottenburg, in München und Köln aus dem ganzen Stadtgebiet. Jedes Angebot hat jetzt eine eigene Seite und eine kostenlose Prüfung auf Review a House.',
            'Zwanzig Angebote pro Stadt sind eine Momentaufnahme, keine Vollerhebung. Es sind Angebotspreise von Eigentümern ohne Makler, „provisionsfrei“ trifft also auf alle 60 zu. Die Zahlen zeigen, was diese Woche angeboten wird, nicht den ganzen Markt.',
          ],
        },
        {
          heading: 'Berlin: Der Median sagt fair, die Spanne sagt: jede Wohnung prüfen',
          paragraphs: [
            'Gemessen an den Mittelwerten des Gutachterausschusses für Weiterverkäufe 2025 im selben Ortsteil verlangt das mittlere Berliner Angebot 5 % mehr. Unauffällig, bis man die Spanne sieht: von 45 % unter bis 44 % über dem Ortsteilmittel, in nur drei Ortsteilen.',
            'In Prenzlauer Berg ist es am deutlichsten. Sechs Angebote liegen zwischen 7.263 und 8.591 € pro m² bei einem Ortsteilmittel von 6.300 €, andere bei 4.584 und 3.491 €. Gleicher Ortsteil, gleiches Datenjahr, mehr als der doppelte Quadratmeterpreis. Etage, Zustand, Aufzug, Balkon und eine bestehende Vermietung erklären viel davon, der Ortsteilname wenig.',
            'Die Hälfte der Berliner Wohnungen wurde 1918 oder früher gebaut. Nur eine stammt aus dem Jahr 2000 oder später. Wer in diesen Ortsteilen Neubau sucht, findet ihn privat kaum.',
          ],
        },
        {
          heading: 'München: höhere Bewertungen, aus einem wichtigen Grund',
          paragraphs: [
            'Münchner Angebote haben die höchste mittlere Bewertung der drei Städte, 7,9 von 10 gegenüber 6,7 in Berlin und 6,3 in Köln. Das heißt nicht, dass sie günstiger sind.',
            'Der amtliche Münchner Bezugswert gilt für die ganze Stadt, nicht pro Stadtteil. Deshalb bleibt unsere Preisprüfung dort aus, und der Preis fließt nicht in die Bewertung ein. Eine Bewertung ohne Preis misst das Zuhause, nicht das Geschäft. Bei einem mittleren Angebotspreis von 8.929 € pro m² ist das Geschäft der schwierige Teil.',
            'Die Münchner Objekte sind auch jünger: keines vor 1960 gebaut, fünf ab 2000, sechs von 20 mit Energieklasse A. Gärten (11 von 20) und Aufzüge (10 von 20) sind viel häufiger als in Berlin.',
          ],
        },
        {
          heading: 'Köln: fast die Hälfte ist vermietet',
          paragraphs: [
            'Neun der 20 Kölner Objekte werden vermietet verkauft, in Berlin drei, in München zwei. Für Selbstnutzer ändert das alles: Wann man einziehen kann, hängt vom Mietverhältnis ab, nicht vom Notartermin.',
            'Wo ein Vergleich mit den Kölner Zahlen des Gutachterausschusses für 2025 möglich ist, verlangt das mittlere Angebot 18 % über dem Stadtteilmittel. Mehrere dieser Stadtteile verzeichnen nur 10 bis 34 Verkäufe im Jahr, ein einzelner Verkauf verschiebt das Mittel also stark. Genau dann senkt unsere Prüfung ihre Verlässlichkeit.',
          ],
        },
        {
          heading: 'Ein Drittel nennt keine Energieklasse',
          paragraphs: [
            '19 der 60 Angebote nennen keine Energieeffizienzklasse. Liegt beim Inserieren ein Energieausweis vor, verlangt § 87 des Gebäudeenergiegesetzes (GEG) für kommerzielle Anzeigen Art des Ausweises, Kennwert, wesentlichen Energieträger, Baujahr und Klasse. Private Verkäufer auf Portalen halten sich nicht immer daran, die Lücke ist also häufig.',
            'Fragen Sie vor der Besichtigung nach dem Ausweis. Spätestens bei der Besichtigung muss er ohnehin vorgelegt werden, und das Fehlen in der Anzeige ist meist ein Versehen, kein Geheimnis. Wichtig ist aber, welche der zwei Ausweisarten vorliegt; der nächste Artikel erklärt, warum.',
          ],
        },
        {
          heading: 'Was daraus folgt',
          paragraphs: [
            'Nicht auf den Stadtdurchschnitt schauen, sondern auf die Wohnung. In allen drei Städten ist die Spanne innerhalb eines Ortsteils größer als der Unterschied zwischen Ortsteilen.',
            'Jedes dieser 60 Objekte hat eine Prüfung, die den Angebotspreis neben die amtlichen Zahlen für die Gegend stellt, wo es sie gibt. Zwei nebeneinander geöffnet, und der Preisunterschied hat meist einen Grund, den man im Angebot sieht.',
          ],
        },
      ],
      sources: marketSources,
    },
  },
  {
    slug: 'two-energy-certificates',
    published: '2026-10-09',
    accent: 'blue',
    en: {
      kicker: 'Before the viewing · Energy',
      title: 'The same building can be class C and class F',
      dek: 'Germany has two kinds of energy certificate. One measures the building, the other measures the people who lived in it. Know which one you are holding.',
      readTime: '5 min read',
      photoLabel: 'Bedarfsausweis or Verbrauchsausweis',
      sections: [
        {
          heading: 'Two certificates, two different questions',
          paragraphs: [
            'A demand certificate (Energiebedarfsausweis) calculates how much energy the building should need, from its walls, windows, roof and heating system, under standard assumptions. It describes the building.',
            'A consumption certificate (Energieverbrauchsausweis) averages what was actually used for heating and hot water over at least 36 months, from heating bills or meter readings, adjusted for the weather. It describes the building plus the habits of whoever lived there.',
            'Both end in the same letter, A+ to H. For a home the class follows the final energy figure in kWh per m² and year: up to 30 is A+, up to 50 A, 75 B, 100 C, 130 D, 160 E, 200 F, 250 G, and above 250 H.',
          ],
        },
        {
          heading: 'Why the letter can flatter a flat',
          paragraphs: [
            'A consumption figure reflects people. A retired couple who heat two rooms, a tenant who was rarely home or a year with a long vacancy all pull the number down. The law asks for vacancy to be accounted for, but only by calculation, and nobody corrects for a household that simply keeps the flat cool.',
            'So two certificates for one unrenovated 1960s block can honestly differ by several classes. When a listing shows a surprisingly good letter for an old building, check the type before you check the letter.',
          ],
        },
        {
          heading: 'When the law insists on the demand version',
          paragraphs: [
            'For residential buildings with fewer than five homes whose building application was filed before 1 November 1977, the Buildings Energy Act (GEG § 80) requires a demand certificate, unless the building met the 1977 thermal-insulation standard when completed or was brought up to it later.',
            'In practice that covers many older detached and semi-detached houses and small blocks. If one of those comes with a consumption certificate, ask why.',
          ],
        },
        {
          heading: 'What a listing should tell you',
          paragraphs: [
            'Where a certificate exists when the advert is placed, GEG § 87 asks the advert to state the certificate type, the energy figure, the main heating fuel, the year of construction and, for homes, the efficiency class.',
            'The seller must show the certificate at the latest during the viewing and hand it over, or a copy, immediately after the purchase contract. You do not have to wait for the viewing to ask.',
          ],
        },
        {
          heading: 'Five questions for the viewing',
          paragraphs: [
            'Is it a demand or a consumption certificate, and from which year? Certificates are issued for ten years.',
            'For a consumption certificate: which years does it cover, and was the flat occupied the whole time?',
            'What heats the building, and how old is the boiler or heat pump?',
            'Which measures does the certificate recommend, and have the owners resolved any of them?',
            'For a flat: what does the last heating cost statement show for this unit? It is the closest thing to your future bill.',
          ],
        },
      ],
      sources: energySources,
    },
    de: {
      kicker: 'Vor der Besichtigung · Energie',
      title: 'Dasselbe Haus kann Klasse C und Klasse F sein',
      dek: 'In Deutschland gibt es zwei Arten von Energieausweis. Der eine misst das Gebäude, der andere die Menschen, die darin gewohnt haben. Wissen Sie, welchen Sie in der Hand halten.',
      readTime: '5 Min. Lesezeit',
      photoLabel: 'Bedarfsausweis oder Verbrauchsausweis',
      sections: [
        {
          heading: 'Zwei Ausweise, zwei Fragen',
          paragraphs: [
            'Der Bedarfsausweis berechnet, wie viel Energie das Gebäude brauchen sollte, aus Wänden, Fenstern, Dach und Heizung, unter Normannahmen. Er beschreibt das Gebäude.',
            'Der Verbrauchsausweis mittelt, was für Heizung und Warmwasser tatsächlich verbraucht wurde, über mindestens 36 Monate aus Heizkostenabrechnungen oder Zählerständen, witterungsbereinigt. Er beschreibt das Gebäude und die Gewohnheiten der Bewohner.',
            'Beide enden mit derselben Klasse von A+ bis H. Bei Wohngebäuden folgt sie dem Endenergiekennwert in kWh pro m² und Jahr: bis 30 ist A+, bis 50 A, 75 B, 100 C, 130 D, 160 E, 200 F, 250 G, darüber H.',
          ],
        },
        {
          heading: 'Warum die Klasse eine Wohnung schönen kann',
          paragraphs: [
            'Ein Verbrauchswert spiegelt Menschen. Ein Rentnerpaar, das zwei Zimmer heizt, ein Mieter, der selten da war, oder ein Jahr mit langem Leerstand drücken den Wert. Leerstand muss zwar berücksichtigt werden, aber nur rechnerisch, und niemand korrigiert einen Haushalt, der die Wohnung einfach kühl hält.',
            'Zwei Ausweise für denselben unsanierten Block aus den 1960ern können deshalb ehrlich um mehrere Klassen auseinanderliegen. Zeigt ein altes Gebäude eine überraschend gute Klasse, erst die Ausweisart prüfen, dann die Klasse.',
          ],
        },
        {
          heading: 'Wann das Gesetz den Bedarfsausweis verlangt',
          paragraphs: [
            'Für Wohngebäude mit weniger als fünf Wohnungen, deren Bauantrag vor dem 1. November 1977 gestellt wurde, verlangt das Gebäudeenergiegesetz (GEG § 80) einen Bedarfsausweis, es sei denn, das Gebäude erfüllte schon bei Fertigstellung die Wärmeschutzverordnung von 1977 oder wurde später auf diesen Stand gebracht.',
            'Das betrifft viele ältere Einfamilien-, Doppelhäuser und kleine Mehrfamilienhäuser. Kommt eines davon mit Verbrauchsausweis, lohnt die Nachfrage.',
          ],
        },
        {
          heading: 'Was eine Anzeige nennen sollte',
          paragraphs: [
            'Liegt beim Inserieren ein Ausweis vor, verlangt GEG § 87 die Art des Ausweises, den Kennwert, den wesentlichen Energieträger, das Baujahr und bei Wohngebäuden die Effizienzklasse.',
            'Spätestens bei der Besichtigung muss der Ausweis vorgelegt werden, nach dem Kaufvertrag unverzüglich übergeben, im Original oder als Kopie. Fragen dürfen Sie schon vorher.',
          ],
        },
        {
          heading: 'Fünf Fragen für die Besichtigung',
          paragraphs: [
            'Bedarfs- oder Verbrauchsausweis, und aus welchem Jahr? Ausweise gelten zehn Jahre.',
            'Beim Verbrauchsausweis: Welche Jahre deckt er ab, und war die Wohnung die ganze Zeit bewohnt?',
            'Womit wird geheizt, und wie alt ist der Kessel oder die Wärmepumpe?',
            'Welche Maßnahmen empfiehlt der Ausweis, und hat die Eigentümergemeinschaft davon etwas beschlossen?',
            'Bei einer Wohnung: Was zeigt die letzte Heizkostenabrechnung für genau diese Einheit? Sie ist am nächsten an Ihrer künftigen Rechnung.',
          ],
        },
      ],
      sources: energySources,
    },
  },
  {
    slug: 'hausgeld-decoded',
    published: '2026-10-09',
    accent: 'clay',
    en: {
      kicker: 'Buying a flat · Running costs',
      title: 'Hausgeld, decoded: the number that tells you how a building is run',
      dek: 'The monthly charge on a flat is not rent and not a tax. Read it right and it tells you whether the next roof is already paid for.',
      readTime: '6 min read',
      photoLabel: 'Wirtschaftsplan, Rücklage, Beschluss-Sammlung',
      sections: [
        {
          heading: 'What Hausgeld pays for',
          paragraphs: [
            'Every owner in a condominium pays a monthly advance to the owners’ association (WEG). It covers three different things that a listing usually lumps into one figure.',
            'Running costs of the building: heating and hot water, water and drainage, waste, cleaning, lift, garden, lighting, caretaker, building insurance.',
            'Management: the property manager’s fee and bank charges.',
            'The maintenance reserve (Erhaltungsrücklage): money saved now for the façade, roof, windows or pipes later. The Condominium Act counts building up an adequate reserve as part of proper management (WEG § 19).',
          ],
        },
        {
          heading: 'What it does not include',
          paragraphs: [
            'Property tax is assessed on each flat and billed to its owner by the city, so it is normally not part of Hausgeld. Your own electricity, internet and contents insurance are not either.',
            'Hausgeld is an advance. After each year the manager prepares an annual statement, and the owners decide on top-up payments or refunds (WEG § 28). A figure that has not changed in years can mean a large top-up is coming.',
          ],
        },
        {
          heading: 'A number to compare: euros per square metre',
          paragraphs: [
            'Divide the monthly Hausgeld by the living area. Across the 60 listings we reviewed in October 2026, the median was €5.68 per m² in Berlin, €5.27 in Munich and €5.17 in Cologne.',
            'Well below that is not automatically good news. A building with a lift, central heating and a caretaker costs more to run, and a low figure in an old building often means a thin reserve. Well above it can mean expensive heating, a large garden, or an association that is wisely saving for work it already knows about.',
          ],
        },
        {
          heading: 'If you will rent the flat out',
          paragraphs: [
            'Only part of Hausgeld can be passed on to a tenant. The operating costs a landlord may recharge are listed in § 2 of the Betriebskostenverordnung; the manager’s fee and the reserve are not among them. Those stay with you.',
            'Ask the seller for the split: the annual statement shows which costs are recoverable. It changes the yield more than most buyers expect.',
          ],
        },
        {
          heading: 'Three documents worth more than the figure',
          paragraphs: [
            'The asset report (Vermögensbericht). Since the 2020 reform, the manager must prepare one after every calendar year, showing the state of the reserve and the main common assets, and make it available to every owner (WEG § 28). Ask the seller for the latest one.',
            'The record of resolutions (Beschluss-Sammlung). The manager keeps every resolution the owners have passed since July 2007, numbered and dated. An owner, or someone the owner authorises, may inspect it (WEG § 24). Ask the seller to authorise you, and read the last three years.',
            'The business plan and the last annual statement. Together they show what the building expects to spend and what it actually spent.',
          ],
        },
        {
          heading: 'What to look for in them',
          paragraphs: [
            'A special levy (Sonderumlage) that has been resolved but not yet paid. Agree in the contract who pays it.',
            'Repairs that keep being discussed and postponed: balconies, roof, heating, pipes. They are coming, and the reserve should be able to carry them.',
            'Disputes between owners or with the manager. A building that argues about small things will argue about large ones.',
            'A reserve that is small relative to the age of the building. There is no legal minimum; compare it with the repairs the minutes mention.',
          ],
        },
      ],
      sources: hausgeldSources,
    },
    de: {
      kicker: 'Wohnung kaufen · Laufende Kosten',
      title: 'Hausgeld entschlüsselt: die Zahl, die zeigt, wie ein Haus geführt wird',
      dek: 'Das monatliche Hausgeld ist weder Miete noch Steuer. Richtig gelesen zeigt es, ob das nächste Dach schon bezahlt ist.',
      readTime: '6 Min. Lesezeit',
      photoLabel: 'Wirtschaftsplan, Rücklage, Beschluss-Sammlung',
      sections: [
        {
          heading: 'Wofür Hausgeld bezahlt',
          paragraphs: [
            'Jeder Eigentümer einer Eigentumswohnung zahlt monatlich einen Vorschuss an die Wohnungseigentümergemeinschaft (WEG). Er deckt drei verschiedene Dinge, die Anzeigen meist in einer Zahl zusammenfassen.',
            'Betriebskosten des Hauses: Heizung und Warmwasser, Wasser und Abwasser, Müll, Reinigung, Aufzug, Garten, Beleuchtung, Hausmeister, Gebäudeversicherung.',
            'Verwaltung: die Vergütung des Verwalters und Kontoführung.',
            'Die Erhaltungsrücklage: Geld, das heute für Fassade, Dach, Fenster oder Leitungen von morgen angespart wird. Das Wohnungseigentumsgesetz zählt die Ansammlung einer angemessenen Rücklage zur ordnungsmäßigen Verwaltung (WEG § 19).',
          ],
        },
        {
          heading: 'Was nicht darin steckt',
          paragraphs: [
            'Die Grundsteuer wird für jede Wohnung festgesetzt und dem Eigentümer direkt von der Stadt berechnet, sie ist also normalerweise nicht im Hausgeld. Eigener Strom, Internet und Hausrat ebenfalls nicht.',
            'Hausgeld ist ein Vorschuss. Nach jedem Jahr erstellt der Verwalter die Jahresabrechnung, und die Eigentümer beschließen Nachzahlungen oder Erstattungen (WEG § 28). Ein seit Jahren unverändertes Hausgeld kann eine große Nachzahlung ankündigen.',
          ],
        },
        {
          heading: 'Eine Vergleichszahl: Euro pro Quadratmeter',
          paragraphs: [
            'Teilen Sie das monatliche Hausgeld durch die Wohnfläche. Bei den 60 Angeboten, die wir im Oktober 2026 geprüft haben, lag der Median in Berlin bei 5,68 € pro m², in München bei 5,27 € und in Köln bei 5,17 €.',
            'Deutlich darunter ist nicht automatisch gut. Ein Haus mit Aufzug, Zentralheizung und Hausmeister kostet mehr, und ein niedriger Wert in einem Altbau bedeutet oft eine dünne Rücklage. Deutlich darüber kann teure Heizung bedeuten, einen großen Garten oder eine Gemeinschaft, die klug für bekannte Arbeiten spart.',
          ],
        },
        {
          heading: 'Wenn Sie vermieten wollen',
          paragraphs: [
            'Nur ein Teil des Hausgelds lässt sich auf Mieter umlegen. Die umlagefähigen Betriebskosten stehen in § 2 der Betriebskostenverordnung; Verwaltervergütung und Rücklage gehören nicht dazu. Die bleiben bei Ihnen.',
            'Fragen Sie nach der Aufteilung: Die Jahresabrechnung zeigt, welche Kosten umlagefähig sind. Das verändert die Rendite stärker, als die meisten erwarten.',
          ],
        },
        {
          heading: 'Drei Unterlagen, die mehr sagen als die Zahl',
          paragraphs: [
            'Der Vermögensbericht. Seit der Reform 2020 muss der Verwalter ihn nach jedem Kalenderjahr erstellen, mit dem Stand der Rücklage und dem wesentlichen Gemeinschaftsvermögen, und jedem Eigentümer zur Verfügung stellen (WEG § 28). Bitten Sie den Verkäufer um den letzten.',
            'Die Beschluss-Sammlung. Der Verwalter führt alle Beschlüsse seit Juli 2007, nummeriert und datiert. Einsicht hat jeder Eigentümer oder ein von ihm ermächtigter Dritter (WEG § 24). Lassen Sie sich vom Verkäufer ermächtigen und lesen Sie die letzten drei Jahre.',
            'Wirtschaftsplan und letzte Jahresabrechnung. Zusammen zeigen sie, was das Haus ausgeben will und was es tatsächlich ausgegeben hat.',
          ],
        },
        {
          heading: 'Worauf Sie darin achten',
          paragraphs: [
            'Eine beschlossene, aber noch nicht gezahlte Sonderumlage. Im Kaufvertrag regeln, wer sie trägt.',
            'Reparaturen, die immer wieder besprochen und vertagt werden: Balkone, Dach, Heizung, Leitungen. Sie kommen, und die Rücklage sollte sie tragen können.',
            'Streit zwischen Eigentümern oder mit dem Verwalter. Wer über Kleinigkeiten streitet, streitet auch über Großes.',
            'Eine Rücklage, die zum Alter des Hauses klein wirkt. Ein gesetzliches Minimum gibt es nicht; vergleichen Sie sie mit den Reparaturen aus den Protokollen.',
          ],
        },
      ],
      sources: hausgeldSources,
    },
  },
];

export const guideArticles: GuideArticle[] = [
  ...newArticles,
  {
    slug: 'where-germany-is-getting-interesting',
    published: '2026-08-24',
    accent: 'clay',
    en: {
      kicker: 'Market notes · Erfurt and beyond',
      title: 'Property investment opportunities in Germany—beyond Berlin',
      dek: 'The shortlist worth getting on a train for, starting with Erfurt—where the railway map changes the investment case.',
      readTime: '7 min read',
      photoLabel: 'Erfurt Hauptbahnhof and the eastern city edge',
      sections: [
        {
          heading: 'First, ignore the “next Berlin” talk',
          paragraphs: [
            'Here’s the number that clears the fog: Destatis recorded an 8.4% fall in German residential prices in 2023, another 1.5% decline in 2024, then a 3.2% rise in 2025. So a city being cheaper than Berlin tells you almost nothing on its own. The useful question is whether people have a reason to stay—good work, a university, a painless train home, or simply an everyday life that feels easier than the price suggests.',
            'My weekend-train shortlist would start with Leipzig and Dresden, then Erfurt. Leipzig has scale and an established cultural pull; Dresden has universities, research and semiconductor jobs; Erfurt has the surprise factor. After those, I’d look selectively at Coburg and towns on the Nuremberg orbit, Koblenz, and individual Ruhr neighbourhoods. Saarland can work too, but only when you can name the local employer or cross-border connection doing the heavy lifting. A cheap square metre is not a thesis.',
          ],
        },
        {
          heading: 'Erfurt is the one that changes when you open the train app',
          paragraphs: [
            'Erfurt became a major ICE junction in 2017. The city gives a journey of roughly 1 hour 40 minutes to Berlin and no more than 2½ hours to Munich or Frankfurt; DB’s Sprinter network runs along the Berlin–Halle–Erfurt–Nuremberg–Munich axis. That is the little shock: a home in a modest-sized Thuringian city can put several much larger job markets within a plausible train ride.',
            'Don’t spend the whole visit admiring the Kramerbrücke and call it research. Walk ten minutes from Hauptbahnhof to the Zughafen, the old freight-yard complex now used for music and creative work, then loop through Krämpfervorstadt and the eastern station edge. The city’s ICE City plan covers up to 30 hectares here. Some blocks feel settled; the next can be rails, empty land and construction. That quick change is exactly why an area average is dangerous.',
            'For the debrief, I’d go to Franz Mehlhose on Löberstraße: red curtains, high ceilings, a garden and a live programme in a family-run place revived in 2010. It is not in the target micro-location, and that is useful—a property trip should also answer whether the wider city gives you places you would genuinely come back to.',
          ],
          googleMaps: { query: 'Kraempfervorstadt Erfurt', label: 'Open the Erfurt walk in Google Maps' },
          map: {
            query: 'Krämpfervorstadt Erfurt',
            label: 'Erfurt: station, ICE City and Krämpfervorstadt', lat: 50.9823, lon: 11.0416,
            places: [
              { name: 'Erfurt Hauptbahnhof', detail: 'The connectivity anchor; walk away from it at commuter time.', query: 'Erfurt Hauptbahnhof' },
              { name: 'Zughafen Kulturbahnhof', detail: 'A former freight-yard complex, about ten minutes away on foot.', query: 'Zughafen Kulturbahnhof Erfurt' },
              { name: 'Krämpfervorstadt', detail: 'Established streets beside fast-changing rail and development edges.', query: 'Kraempfervorstadt Erfurt' },
              { name: 'Franz Mehlhose', detail: 'A good, unhurried place to compare notes after the walk.', query: 'Franz Mehlhose Löberstraße 12 Erfurt' },
            ],
          },
        },
        {
          heading: 'What Erfurt wins—and what it does not',
          paragraphs: [
            'Leipzig wins on labour-market depth, culture and the number of neighbourhoods with regular buyer demand—but the famous ones already know they are famous. Dresden brings a different strength: universities, research and chip investment. Erfurt is smaller and resale can be slower. Its advantage is centrality, not magic.',
            'Before you call anything a deal, compare completed sales, a realistic rent under the local Mietspiegel, non-recoverable Hausgeld, the building reserve and the exact five-minute walk around the front door. Do that walk after dark too. The train timetable is a very good reason to look; it is not permission to overpay.',
          ],
        },
      ],
      sources: investmentSources,
    },
    de: {
      kicker: 'Marktnotizen · Erfurt und mehr',
      title: 'Immobilienchancen in Deutschland—jenseits von Berlin',
      dek: 'Für diese Shortlist lohnt sich die Zugfahrt. Los geht’s mit Erfurt—wo der Fahrplan die Investmentrechnung verändert.',
      readTime: '7 Min. Lesezeit',
      photoLabel: 'Erfurter Hauptbahnhof und die östliche Innenstadt',
      sections: [
        {
          heading: 'Vergiss erst mal das Gerede vom „nächsten Berlin“',
          paragraphs: [
            'Eine Zahl räumt schon viel Nebel weg: Laut Destatis fielen die deutschen Wohnimmobilienpreise 2023 um 8,4 %, 2024 noch einmal um 1,5 % und stiegen 2025 wieder um 3,2 %. „Günstiger als Berlin“ sagt also fast nichts. Spannend wird es erst, wenn Menschen einen Grund zum Bleiben haben: gute Arbeit, eine Uni, ein schmerzfreier Zug nach Hause oder einfach einen Alltag, der besser ist, als der Quadratmeterpreis vermuten lässt.',
            'Meine Wochenend-mit-dem-Zug-Liste beginnt mit Leipzig, Dresden und dann Erfurt. Leipzig hat Größe und Kultur, Dresden Forschung, Hochschulen und Halbleiterjobs. Erfurt hat den Überraschungseffekt. Danach würde ich selektiv auf Coburg, Orte im Nürnberger Radius, Koblenz und einzelne Ruhrgebietskieze schauen. Auch im Saarland kann etwas funktionieren—aber nur, wenn du den Arbeitgeber oder die Grenzverbindung benennen kannst, die Nachfrage bringt. Ein billiger Quadratmeter ist noch keine Strategie.',
          ],
        },
        {
          heading: 'Erfurt sieht anders aus, sobald du die Bahn-App öffnest',
          paragraphs: [
            'Seit 2017 ist Erfurt ein wichtiger ICE-Knoten. Die Stadt nennt rund 1 Stunde 40 Minuten nach Berlin und höchstens 2½ Stunden nach München oder Frankfurt; die Sprinter-Achse der Bahn läuft über Berlin, Halle, Erfurt, Nürnberg und München. Das ist der kleine Aha-Moment: Eine Wohnung in einer eher kleinen thüringischen Stadt kann mehrere große Arbeitsmärkte in halbwegs realistische Zugnähe rücken.',
            'Bitte nicht nur die Krämerbrücke fotografieren und das dann Recherche nennen. Vom Hauptbahnhof sind es zu Fuß etwa zehn Minuten bis zum Zughafen, einem alten Güterbahnhof mit Musik und Kreativarbeit. Von dort kannst du durch die Krämpfervorstadt und am östlichen Bahnhofsrand zurücklaufen. Der ICE-City-Rahmenplan umfasst hier bis zu 30 Hektar. Ein Block wirkt fertig, der nächste nach Gleisen, Brache und Baustelle. Genau deshalb ist der Vierteldurchschnitt hier so wenig wert.',
            'Für die Nachbesprechung würde ich zu Franz Mehlhose in die Löberstraße gehen: rote Samtvorhänge, hohe Decken, Garten und Liveprogramm in einem Familienbetrieb, der 2010 wiederbelebt wurde. Das liegt nicht im eigentlichen Suchgebiet—und das ist gut. Eine Immobilienreise sollte auch klären, ob die Stadt Orte hat, zu denen du wirklich zurückkehren willst.',
          ],
          googleMaps: { query: 'Kraempfervorstadt Erfurt', label: 'Erfurt-Runde in Google Maps öffnen' },
          map: {
            query: 'Krämpfervorstadt Erfurt',
            label: 'Erfurt: Bahnhof, ICE City und Krämpfervorstadt', lat: 50.9823, lon: 11.0416,
            places: [
              { name: 'Erfurt Hauptbahnhof', detail: 'Der Mobilitätsanker—lauf von hier aus zur Pendelzeit los.', query: 'Erfurt Hauptbahnhof' },
              { name: 'Zughafen Kulturbahnhof', detail: 'Alter Güterbahnhof und Kreativort, etwa zehn Minuten zu Fuß entfernt.', query: 'Zughafen Kulturbahnhof Erfurt' },
              { name: 'Krämpfervorstadt', detail: 'Gewachsene Straßen direkt neben Bahn- und Entwicklungsflächen.', query: 'Kraempfervorstadt Erfurt' },
              { name: 'Franz Mehlhose', detail: 'Ein guter, entspannter Ort für die Notizen nach dem Rundgang.', query: 'Franz Mehlhose Löberstraße 12 Erfurt' },
            ],
          },
        },
        {
          heading: 'Was Erfurt gewinnt—und was eben nicht',
          paragraphs: [
            'Leipzig gewinnt bei Arbeitsmarkt, Kultur und der Zahl der Viertel mit regelmäßiger Nachfrage—nur wissen die bekannten Viertel längst, dass sie bekannt sind. Dresden hat Hochschulen, Forschung und Chip-Investitionen. Erfurt ist kleiner, der Wiederverkauf kann länger dauern. Sein Vorteil ist die zentrale Lage, nicht irgendein Zauber.',
            'Bevor du etwas einen Deal nennst, vergleiche echte Kaufpreise, eine realistische Miete nach Mietspiegel, nicht umlagefähiges Hausgeld, Rücklagen und den genauen Fünf-Minuten-Radius vor der Haustür. Geh dort auch abends entlang. Der Fahrplan ist ein sehr guter Grund hinzusehen—aber kein Grund, zu viel zu zahlen.',
          ],
        },
      ],
      sources: investmentSources,
    },
  },
  {
    slug: 'berlin-with-children',
    published: '2026-08-24',
    accent: 'green',
    en: {
      kicker: 'Neighbourhood fieldwork · Berlin',
      title: 'Berlin with children: three neighbourhoods that work',
      dek: 'Forget the postcode for an afternoon. Bring a scooter, trace the school route and find out where you would go on a wet Tuesday.',
      readTime: '8 min read',
      photoLabel: 'A weekday school route in north-west Prenzlauer Berg',
      sections: [
        {
          heading: '1. Gleimkiez: Prenzlauer Berg with its sleeves rolled up',
          paragraphs: [
            'If someone says only “Prenzlauer Berg,” ask which ten-minute walk they mean. In Gleimkiez, Falkplatz, the Mauerpark edge, sport and groceries sit close enough that a child can slowly claim the route as their own. On a rainy day, MACHmit! on Senefelderstraße is the rare recommendation that is genuinely useful: a former church turned hands-on children’s museum, not another vague promise of “lots to do.”',
            'The bargain you make is with bustle. Mauerpark weekends spill outward; the rail edge hums; Schönfließer Brücke can look easy on a map and feel very different with a small cyclist beside you. Go once at 8:00 on a weekday and once on Sunday afternoon. Also listen from the actual room: a rear courtyard and a street-facing flat in the same building can belong to two different Berlins.',
          ],
          googleMaps: { query: 'Gleimstrasse Berlin', label: 'Open Gleimkiez in Google Maps' },
          map: {
            query: 'Gleimviertel Berlin',
            label: 'Gleimkiez family radius', lat: 52.5472, lon: 13.4045,
            places: [
              { name: 'Falkplatz', detail: 'Play and sports space just north of Mauerpark.', query: 'Falkplatz Berlin' },
              { name: 'MACHmit! Museum', detail: 'Hands-on children’s museum in a former church.', query: 'MACHmit Museum Senefelderstrasse 5 Berlin' },
              { name: 'Schönfließer Brücke', detail: 'Test the real school and station crossing, not just map distance.', query: 'Schoenfliesser Bruecke Berlin' },
            ],
          },
        },
        {
          heading: '2. Friedenau: where the useful places hide in plain sight',
          paragraphs: [
            'Friedenau feels almost improbably small after central Berlin: short blocks, old street trees and errands that join up without a transport plan. The district profile counts eleven public playgrounds and two public primary schools. Start at Breslauer Platz on market day, pick up bread at Lula am Markt, then wander towards Perelsplatz. It is not a blockbuster afternoon, which is precisely the charm—you are rehearsing a normal Saturday.',
            'Then spoil the idyll on purpose. Cross Hauptstraße, stand beside Bundesallee and walk towards the Ringbahn. Noise and air can change in a block. Ask the school directly about catchments and places; a pin nearby never guarantees admission. Friedenau is best when its calm is real at the exact front door, not just present in the estate agent’s district name.',
          ],
          googleMaps: { query: 'Breslauer Platz Berlin Friedenau', label: 'Open the Friedenau loop in Google Maps' },
          map: {
            query: 'Breslauer Platz Berlin Friedenau',
            label: 'Friedenau: a compact everyday loop', lat: 52.4718, lon: 13.3282,
            places: [
              { name: 'Breslauer Platz', detail: 'Market square and the small centre of the neighbourhood.', query: 'Breslauer Platz Berlin Friedenau' },
              { name: 'Lula am Markt', detail: 'Bread, coffee and an easy pause while you watch the square.', query: 'Lula am Markt Lauterstrasse 14 Berlin' },
              { name: 'Familienzentrum Friedenau', detail: 'Programmes and practical support for local families.', query: 'Familienzentrum Friedenau Berlin' },
              { name: 'Perelsplatz', detail: 'A green pause inside the residential grid.', query: 'Perelsplatz Berlin' },
            ],
          },
        },
        {
          heading: '3. Karlshorst by Seepark: the one people forget to mention',
          paragraphs: [
            'Karlshorst is less polished in photographs and often much easier in real life. Seepark’s playground reopened in 2024 after an expansion to roughly 1,200 m², and the new primary school was planned for more than 430 places. Café TreBo is a proper children’s café rather than a café where children are merely tolerated; Tierpark is the sort of weekend plan that needs no committee meeting.',
            'The catch is hidden in the walk to the S-Bahn. A listing can say “Karlshorst” and still hand you a long daily feeder trip. Trace the route at child-speed, check the tram after 20:00 and ask what nearby construction will look like for the years you expect to live there. The pleasant surprise is space; the risk is paying for connectivity that exists only at the centre of the map label.',
          ],
          googleMaps: { query: 'Seepark Karlshorst Berlin', label: 'Open Seepark Karlshorst in Google Maps' },
          map: {
            query: 'Seepark Karlshorst Berlin',
            label: 'Karlshorst: Seepark and the everyday anchors', lat: 52.4812, lon: 13.5275,
            places: [
              { name: 'Seepark playground', detail: 'Expanded play space reopened in 2024.', query: 'Spielplatz Seepark Karlshorst Berlin' },
              { name: 'Seepark primary school', detail: 'New school campus at Blockdammweg 60.', query: 'Seepark Grundschule Blockdammweg 60 Berlin' },
              { name: 'Café TreBo', detail: 'A children’s café where play is part of the plan.', query: 'Cafe TreBo Karlshorst Berlin' },
              { name: 'Potpourri family centre', detail: 'Local family programmes at Eginhardstraße 9.', query: 'Familienzentrum Potpourri Eginhardstrasse 9 Berlin' },
            ],
          },
        },
      ],
      sources: familySources,
    },
    de: {
      kicker: 'Kiezcheck · Berlin',
      title: 'Berlin mit Kindern: drei Kieze, die funktionieren',
      dek: 'Vergiss für einen Nachmittag die Postleitzahl. Nimm den Roller mit, teste den Schulweg und finde heraus, wo ihr an einem nassen Dienstag hingehen würdet.',
      readTime: '8 Min. Lesezeit',
      photoLabel: 'Ein Schulweg an einem Wochentag im Nordwesten Prenzlauer Bergs',
      sections: [
        {
          heading: '1. Gleimkiez: Prenzlauer Berg mit hochgekrempelten Ärmeln',
          paragraphs: [
            'Wenn jemand nur „Prenzlauer Berg“ sagt, frag nach dem genauen Zehn-Minuten-Radius. Im Gleimkiez liegen Falkplatz, Mauerparkkante, Sport und Einkaufen so nah beieinander, dass Kinder den Weg langsam selbst erobern können. Bei Regen ist das MACHmit! in der Senefelderstraße wirklich brauchbar: eine ehemalige Kirche als Mitmachmuseum, nicht wieder nur das schwammige Versprechen von „vielen Angeboten“.',
            'Dafür musst du den Trubel mögen. Am Wochenende schwappt der Mauerpark in die Nebenstraßen, an der Bahn summt es, und die Schönfließer Brücke fühlt sich mit kleinem Fahrrad ganz anders an als auf der Karte. Geh einmal werktags um acht und einmal sonntagnachmittags hin. Und hör aus dem echten Zimmer: Ruhiger Hof und Vorderhaus können im selben Gebäude zwei verschiedene Berlins sein.',
          ],
          googleMaps: { query: 'Gleimstrasse Berlin', label: 'Gleimkiez in Google Maps öffnen' },
          map: {
            query: 'Gleimviertel Berlin',
            label: 'Familienradius im Gleimkiez', lat: 52.5472, lon: 13.4045,
            places: [
              { name: 'Falkplatz', detail: 'Spiel und Sport direkt nördlich vom Mauerpark.', query: 'Falkplatz Berlin' },
              { name: 'MACHmit! Museum', detail: 'Kindermuseum zum Mitmachen in einer ehemaligen Kirche.', query: 'MACHmit Museum Senefelderstrasse 5 Berlin' },
              { name: 'Schönfließer Brücke', detail: 'Den echten Schul- und S-Bahn-Weg testen, nicht nur die Luftlinie.', query: 'Schoenfliesser Bruecke Berlin' },
            ],
          },
        },
        {
          heading: '2. Friedenau: Hier liegen die guten Dinge einfach so herum',
          paragraphs: [
            'Nach Mitte wirkt Friedenau fast unwahrscheinlich klein: kurze Blöcke, alte Straßenbäume und Besorgungen, die ohne Verkehrsplan zusammenpassen. Das Bezirksprofil zählt elf öffentliche Spielplätze und zwei öffentliche Grundschulen. Starte am Markttag auf dem Breslauer Platz, hol Brot bei Lula am Markt und lauf Richtung Perelsplatz. Kein spektakulärer Nachmittag—genau das ist der Reiz. Du probst einen normalen Samstag.',
            'Dann mach die Idylle absichtlich kaputt: Überquere die Hauptstraße, stell dich an die Bundesallee und lauf bis zur Ringbahn. Lärm und Luft wechseln in einem Block. Wegen Einzugsgebiet und Plätzen direkt bei der Schule fragen; ein Pin in der Nähe ist keine Zusage. Friedenau ist dann gut, wenn die Ruhe wirklich vor der Haustür liegt und nicht nur im Bezirksnamen des Exposés.',
          ],
          googleMaps: { query: 'Breslauer Platz Berlin Friedenau', label: 'Friedenau-Runde in Google Maps öffnen' },
          map: {
            query: 'Breslauer Platz Berlin Friedenau',
            label: 'Friedenau: kurze Wege im Alltag', lat: 52.4718, lon: 13.3282,
            places: [
              { name: 'Breslauer Platz', detail: 'Markt und kleiner Mittelpunkt des Viertels.', query: 'Breslauer Platz Berlin Friedenau' },
              { name: 'Lula am Markt', detail: 'Brot, Kaffee und eine gute Pause zum Platz-Beobachten.', query: 'Lula am Markt Lauterstrasse 14 Berlin' },
              { name: 'Familienzentrum Friedenau', detail: 'Kurse, Treffen und praktische Hilfe für Familien.', query: 'Familienzentrum Friedenau Berlin' },
              { name: 'Perelsplatz', detail: 'Grüne Pause mitten im Wohnraster.', query: 'Perelsplatz Berlin' },
            ],
          },
        },
        {
          heading: '3. Karlshorst am Seepark: die Ecke, die gern vergessen wird',
          paragraphs: [
            'Karlshorst ist auf Fotos weniger glatt und im Alltag oft viel einfacher. Der Spielplatz im Seepark wurde 2024 nach einem Ausbau auf rund 1.200 m² wiedereröffnet; die neue Grundschule war für mehr als 430 Plätze geplant. Café TreBo ist ein echtes Kindercafé und nicht bloß ein Café, in dem Kinder geduldet werden. Und der Tierpark ist so ein Wochenendplan, für den keine Familienkonferenz nötig ist.',
            'Der Haken versteckt sich im Weg zur S-Bahn. Im Exposé kann „Karlshorst“ stehen und im Alltag trotzdem ein langer Zubringer warten. Lauf die Strecke im Kindertempo, prüfe den Tram-Takt nach 20 Uhr und frag, wie lange im Umfeld gebaut wird. Die schöne Überraschung ist der Platz; das Risiko ist, für eine Anbindung zu zahlen, die nur in der Mitte des Kartennamens gut aussieht.',
          ],
          googleMaps: { query: 'Seepark Karlshorst Berlin', label: 'Seepark Karlshorst in Google Maps öffnen' },
          map: {
            query: 'Seepark Karlshorst Berlin',
            label: 'Karlshorst: Seepark und wichtige Alltagsorte', lat: 52.4812, lon: 13.5275,
            places: [
              { name: 'Spielplatz Seepark', detail: 'Der deutlich vergrößerte Spielplatz ist seit 2024 wieder offen.', query: 'Spielplatz Seepark Karlshorst Berlin' },
              { name: 'Seepark-Grundschule', detail: 'Neuer Schulstandort am Blockdammweg 60.', query: 'Seepark Grundschule Blockdammweg 60 Berlin' },
              { name: 'Café TreBo', detail: 'Ein Kindercafé, bei dem Spielen wirklich dazugehört.', query: 'Cafe TreBo Karlshorst Berlin' },
              { name: 'Familienzentrum Potpourri', detail: 'Familienangebote in der Eginhardstraße 9.', query: 'Familienzentrum Potpourri Eginhardstrasse 9 Berlin' },
            ],
          },
        },
      ],
      sources: familySources,
    },
  },
  {
    slug: 'five-streets-worth-a-detour',
    published: '2026-08-24',
    accent: 'blue',
    en: {
      kicker: 'Street notes · Five cities',
      title: 'Five streets that explain five German cities',
      dek: 'Come for the coffee, stay long enough to hear the tram and inspect the side streets. Each walk doubles as a sharper house-hunting guide.',
      readTime: '9 min read',
      photoLabel: 'Shopfront details, café tables and evening light',
      sections: [
        {
          heading: 'Berlin · Kantstraße',
          paragraphs: [
            'Start beneath the Savignyplatz tracks at Bücherbogen. It opened in 1980 and now fills several brick arches with architecture, photography and design books; it is dangerously easy to lose half an hour before the walk has begun. Then pass Kant Kino, one of Berlin’s oldest cinemas, and keep going east. Here is the detail I love: Berlin’s own food history traces the street’s first Chinese restaurant back to 1923. Today the mix runs through Cantonese cooking, noodles, Japanese groceries and old West Berlin bars without ever becoming one neat “food district.”',
            'End at Schwarzes Café, number 148, where breakfast still stretches into the small hours and the neon parrot has watched several versions of Berlin pass by. It is now mostly open until 3 a.m. and still takes cash only. If you are viewing a flat, pause the romance for a minute: the S-Bahn is both compass and soundtrack. Hear the bedroom with the window open, then walk into the courtyard. The difference can be the entire purchase decision.',
          ],
          googleMaps: { query: 'Kantstrasse Berlin', label: 'Open Kantstraße in Google Maps' },
          map: { query: 'Kantstraße Berlin', label: 'Kantstraße, Berlin', lat: 52.5062, lon: 13.3117, places: [
            { name: 'Bücherbogen', detail: 'Architecture, design and art books under the tracks.', query: 'Buecherbogen Savignyplatz Berlin' },
            { name: 'Kant Kino', detail: 'One of Berlin’s oldest cinemas, at number 54.', query: 'Kant Kino Kantstrasse 54 Berlin' },
            { name: 'Schwarzes Café', detail: 'The late-night West Berlin institution at number 148.', query: 'Schwarzes Cafe Kantstrasse 148 Berlin' },
          ] },
        },
        {
          heading: 'Munich · Türkenstraße',
          paragraphs: [
            'Türkenstraße feels as if someone keeps leaving doors open onto other lives: students, galleries, breakfast tables, bicycles, the museum crowd. At number 17, slip into the tiny Türkentor. Entry is free and the whole room is given to a Walter De Maria installation—a lovely five-minute interruption between the much bigger museums around it.',
            'Then take the ten-second walk to Café Puck at number 33, open daily from 9 and cheerfully calling itself the neighbourhood’s living room. This is cultural proximity you can actually use, not an amenity bullet point. It also means deliveries, students and voices on the pavement. For a viewing, stay until early evening; Maxvorstadt changes volume when lectures finish.',
          ],
          googleMaps: { query: 'Tuerkenstrasse Munich', label: 'Open Türkenstraße in Google Maps' },
          stops: [
            { name: 'Türkentor', detail: 'Free entry; check the seasonal opening hours.', query: 'Tuerkentor Tuerkenstrasse 17 Munich' },
            { name: 'Café Puck', detail: 'Breakfast, coffee and neighbourhood life from 9 a.m.', query: 'Cafe Puck Tuerkenstrasse 33 Munich' },
          ],
        },
        {
          heading: 'Hamburg · Schulterblatt',
          paragraphs: [
            'Schulterblatt does not make its contradictions subtle. The Rote Flora—the self-organised, occupied cultural project at what used to be number 71 and is now Achidi-John-Platz 1—has been here since 1989. A few doors away you get brunch queues, bars and polished shopfronts. Don’t flatten that into “edgy charm”; the friction is political history, nightlife and rising commercial pressure sharing one short street.',
            'For a pause, Blattgold at number 83 does vegetarian dinner and a weekend brunch; for serious coffee, detour around the corner to the elbgold roastery in the old Schanzenhöfe on Lagerstraße. Then do the important property-viewing trick: walk one block sideways. Schulterblatt can be loud and public while a nearby residential street feels almost tucked away. That change, over 200 metres, is the real neighbourhood review.',
          ],
          googleMaps: { query: 'Schulterblatt Hamburg', label: 'Open Schulterblatt in Google Maps' },
          stops: [
            { name: 'Rote Flora', detail: 'The self-organised cultural project at Achidi-John-Platz 1.', query: 'Rote Flora Achidi-John-Platz 1 Hamburg' },
            { name: 'Blattgold', detail: 'Vegetarian dinner and weekend brunch at number 83.', query: 'Blattgold Schulterblatt 83 Hamburg' },
            { name: 'elbgold Schanze', detail: 'The roastery detour in the old Schanzenhöfe.', query: 'elbgold Lagerstrasse 34c Hamburg' },
          ],
        },
        {
          heading: 'Cologne · Körnerstraße',
          paragraphs: [
            'Körnerstraße is short enough that rushing it would be ridiculous. Start with an espresso at Van Dyck, number 43, then look into the small shops and studios Cologne Tourism celebrates. Finish at Café Sehnsucht at number 67: it has been part of Ehrenfeld since 1982, bakes its own bread and cake, and turns from café into restaurant later in the day. That is a very good two-stop explanation of the street—independent, unshowy and built for regulars.',
            'The former industrial fabric around Ehrenfeld gives the area its texture, but the tracks also give it noise. Look beyond the photogenic shopfronts towards the rail approaches and Körnerpark. A few hundred metres can change both the charm and your sleep, so stand outside the exact building after a train passes before deciding the street is perfect.',
          ],
          googleMaps: { query: 'Koernerstrasse Cologne Ehrenfeld', label: 'Open Körnerstraße in Google Maps' },
          stops: [
            { name: 'Van Dyck', detail: 'The Ehrenfeld espresso bar at number 43.', query: 'Van Dyck Koernerstrasse 43 Cologne' },
            { name: 'Café Sehnsucht', detail: 'House-baked bread and cake at number 67.', query: 'Cafe Sehnsucht Koernerstrasse 67 Cologne' },
          ],
        },
        {
          heading: 'Frankfurt · Braubachstraße',
          paragraphs: [
            'Braubachstraße is Frankfurt compressed into a few blocks: reconstructed old-town lanes on one side, early-20th-century buildings and tram rails on the other, with contemporary art wedged between them. Start at IIMORI, number 24, for a green-tea roll or melonpan from its French-Japanese bakery. Then walk past the angular MMK building on Domstraße. Important current note: the main museum is closed for fire-safety work, so check its visitor page before building a day around it.',
            'What I like here is the seam, not the idea that everything old is authentic and everything new is tasteful. The rebuilt lanes, surviving fabric and galleries keep arguing with one another. It is a brilliant place to understand central Frankfurt on foot; it is not automatically restful. If the listing is nearby, count trams and tour groups as carefully as rooms.',
          ],
          googleMaps: { query: 'Braubachstrasse Frankfurt am Main', label: 'Open Braubachstraße in Google Maps' },
          stops: [
            { name: 'IIMORI Pâtisserie', detail: 'French-Japanese baking at number 24.', query: 'IIMORI Patisserie Braubachstrasse 24 Frankfurt' },
            { name: 'MUSEUM MMK', detail: 'The main building is currently closed; check before visiting.', query: 'MUSEUM MMK Domstrasse 10 Frankfurt' },
          ],
        },
      ],
      sources: streetSources,
    },
    de: {
      kicker: 'Straßennotizen · Fünf Städte',
      title: 'Fünf Straßen, die fünf deutsche Städte erklären',
      dek: 'Komm wegen des Kaffees, bleib lang genug für Tramgeräusch und Seitenstraßen. Jede Runde zeigt nebenbei, worauf du bei der Haussuche achten solltest.',
      readTime: '9 Min. Lesezeit',
      photoLabel: 'Ladendetails, Cafétische und Abendlicht',
      sections: [
        {
          heading: 'Berlin · Kantstraße',
          paragraphs: [
            'Starte unter den Gleisen am Savignyplatz bei Bücherbogen. Seit 1980 füllen Architektur-, Foto- und Designbücher dort mehrere Backsteinbögen; man verliert leicht eine halbe Stunde, bevor der Spaziergang überhaupt begonnen hat. Dann am Kant Kino vorbei, einem der ältesten Kinos Berlins, und weiter nach Osten. Mein Lieblingsdetail: Die Berliner Gastrogeschichte datiert das erste chinesische Restaurant der Straße auf 1923. Heute liegen kantonesische Küche, Nudelläden, japanische Lebensmittel und alte West-Berliner Bars nebeneinander, ohne sich zu einem sauberen „Food District“ aufzuräumen.',
            'Ende im Schwarzen Café in Hausnummer 148, wo Frühstück bis tief in die Nacht reicht und der Neonpapagei schon mehrere Berlins gesehen hat. Inzwischen ist meist bis 3 Uhr offen, bezahlt wird weiter nur bar. Bei einer Besichtigung kurz die Romantik ausschalten: Die S-Bahn ist Kompass und Soundtrack zugleich. Schlafzimmer mit offenem Fenster anhören, dann in den Hof gehen. Dieser Unterschied kann die ganze Kaufentscheidung sein.',
          ],
          googleMaps: { query: 'Kantstrasse Berlin', label: 'Kantstraße in Google Maps öffnen' },
          map: { query: 'Kantstraße Berlin', label: 'Kantstraße, Berlin', lat: 52.5062, lon: 13.3117, places: [
            { name: 'Bücherbogen', detail: 'Architektur-, Design- und Kunstbücher unter den Gleisen.', query: 'Buecherbogen Savignyplatz Berlin' },
            { name: 'Kant Kino', detail: 'Eines der ältesten Kinos Berlins, in Hausnummer 54.', query: 'Kant Kino Kantstrasse 54 Berlin' },
            { name: 'Schwarzes Café', detail: 'West-Berliner Nachtinstitution in Hausnummer 148.', query: 'Schwarzes Cafe Kantstrasse 148 Berlin' },
          ] },
        },
        {
          heading: 'München · Türkenstraße',
          paragraphs: [
            'In der Türkenstraße stehen dauernd Türen in andere Leben offen: Studierende, Galerien, Frühstückstische, Fahrräder, Museumspublikum. In Hausnummer 17 unbedingt kurz ins winzige Türkentor schauen. Der Eintritt ist frei und der ganze Raum gehört einer Installation von Walter De Maria—eine herrliche Fünf-Minuten-Unterbrechung zwischen den viel größeren Museen drumherum.',
            'Danach sind es ein paar Schritte bis zum Café Puck in Nummer 33, täglich ab 9 Uhr offen und ganz unverkrampft als Wohnzimmer des Viertels beschrieben. Das ist Kulturnähe, die man wirklich benutzt, kein Stichpunkt im Exposé. Dazu gehören aber auch Lieferverkehr, Studierende und Stimmen auf dem Gehweg. Bleib bei einer Besichtigung bis zum frühen Abend; wenn die Vorlesungen enden, dreht Maxvorstadt die Lautstärke hoch.',
          ],
          googleMaps: { query: 'Tuerkenstrasse Munich', label: 'Türkenstraße in Google Maps öffnen' },
          stops: [
            { name: 'Türkentor', detail: 'Eintritt frei; saisonale Öffnungszeiten vorher prüfen.', query: 'Tuerkentor Tuerkenstrasse 17 Munich' },
            { name: 'Café Puck', detail: 'Frühstück, Kaffee und Kiezleben ab 9 Uhr.', query: 'Cafe Puck Tuerkenstrasse 33 Munich' },
          ],
        },
        {
          heading: 'Hamburg · Schulterblatt',
          paragraphs: [
            'Das Schulterblatt versteckt seine Widersprüche nicht. Die Rote Flora—das selbstverwaltete, besetzte Kulturprojekt an der heutigen Adresse Achidi-John-Platz 1, früher Schulterblatt 71—ist seit 1989 hier. Ein paar Türen weiter warten Brunchschlangen, Bars und polierte Schaufenster. Das bitte nicht als „rauen Charme“ glattbügeln: Hier teilen sich politische Geschichte, Nachtleben und steigender Gewerbedruck dieselbe kurze Straße.',
            'Für die Pause gibt es im Blattgold in Nummer 83 vegetarisches Abendessen und Wochenendbrunch; für ernsthaften Kaffee gehst du um die Ecke zur elbgold-Rösterei in den alten Schanzenhöfen an der Lagerstraße. Danach kommt der wichtigste Besichtigungstrick: einen Block zur Seite laufen. Das Schulterblatt ist laut und öffentlich, während eine Wohnstraße daneben fast versteckt wirken kann. Dieser Wechsel auf 200 Metern ist der eigentliche Kiezcheck.',
          ],
          googleMaps: { query: 'Schulterblatt Hamburg', label: 'Schulterblatt in Google Maps öffnen' },
          stops: [
            { name: 'Rote Flora', detail: 'Das selbstverwaltete Kulturprojekt am Achidi-John-Platz 1.', query: 'Rote Flora Achidi-John-Platz 1 Hamburg' },
            { name: 'Blattgold', detail: 'Vegetarisches Abendessen und Wochenendbrunch in Nummer 83.', query: 'Blattgold Schulterblatt 83 Hamburg' },
            { name: 'elbgold Schanze', detail: 'Der Rösterei-Umweg in den alten Schanzenhöfen.', query: 'elbgold Lagerstrasse 34c Hamburg' },
          ],
        },
        {
          heading: 'Köln · Körnerstraße',
          paragraphs: [
            'Die Körnerstraße ist so kurz, dass Eile hier albern wäre. Erst ein Espresso bei Van Dyck in Nummer 43, dann in die kleinen Läden und Ateliers schauen, die auch KölnTourismus an der Straße hervorhebt. Zum Schluss Café Sehnsucht in Nummer 67: seit 1982 Teil von Ehrenfeld, mit eigenem Brot und Kuchen und später am Tag Restaurant. Diese zwei Stopps erklären die Straße ziemlich gut—unabhängig, unaufgeregt und für Stammgäste gemacht.',
            'Die frühere Industrie rund um Ehrenfeld gibt der Gegend ihre Textur, die Gleise liefern aber auch Lärm. Hinter den schönen Schaufenstern deshalb Bahnzugänge und Körnerpark mitdenken. Ein paar hundert Meter verändern Charme und Nachtruhe; bevor die Straße perfekt scheint, einmal vor dem echten Haus stehen bleiben, während ein Zug vorbeifährt.',
          ],
          googleMaps: { query: 'Koernerstrasse Cologne Ehrenfeld', label: 'Körnerstraße in Google Maps öffnen' },
          stops: [
            { name: 'Van Dyck', detail: 'Die Ehrenfelder Espressobar in Nummer 43.', query: 'Van Dyck Koernerstrasse 43 Cologne' },
            { name: 'Café Sehnsucht', detail: 'Eigenes Brot und Kuchen in Nummer 67.', query: 'Cafe Sehnsucht Koernerstrasse 67 Cologne' },
          ],
        },
        {
          heading: 'Frankfurt · Braubachstraße',
          paragraphs: [
            'Die Braubachstraße ist Frankfurt auf wenigen Blöcken zusammengedrückt: rekonstruierte Altstadtgassen auf der einen Seite, Häuser des frühen 20. Jahrhunderts und Tramschienen auf der anderen, dazwischen Gegenwartskunst. Starte bei IIMORI in Nummer 24 mit Grüntee-Rolle oder Melonpan aus der französisch-japanischen Backstube. Dann am kantigen MMK in der Domstraße vorbei. Wichtig: Das Haupthaus ist gerade wegen Brandschutzarbeiten geschlossen—vor einem Museumsplan unbedingt die Besuchsseite prüfen.',
            'Ich mag hier die Naht, nicht die Idee, alles Alte sei automatisch echt und alles Neue geschmackvoll. Rekonstruierte Gassen, erhaltene Bausubstanz und Galerien streiten sichtbar miteinander. Zentral-Frankfurt lässt sich von hier großartig zu Fuß verstehen; ruhig wird es dadurch nicht. Bei einer Wohnung in der Nähe Trams und Besuchergruppen so aufmerksam zählen wie Zimmer.',
          ],
          googleMaps: { query: 'Braubachstrasse Frankfurt am Main', label: 'Braubachstraße in Google Maps öffnen' },
          stops: [
            { name: 'IIMORI Pâtisserie', detail: 'Französisch-japanische Backstube in Nummer 24.', query: 'IIMORI Patisserie Braubachstrasse 24 Frankfurt' },
            { name: 'MUSEUM MMK', detail: 'Das Haupthaus ist gerade geschlossen; vorher aktuell prüfen.', query: 'MUSEUM MMK Domstrasse 10 Frankfurt' },
          ],
        },
      ],
      sources: streetSources,
    },
  },
];

export function getGuideArticle(slug: string) {
  return guideArticles.find((article) => article.slug === slug);
}

export function guideCopy(article: GuideArticle, locale: Locale) {
  return article[locale];
}
