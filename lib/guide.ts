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
  { label: 'Berlin: Prenzlauer Berg family neighborhoods', href: 'https://www.berlin.de/special/stadtteile/prenzlauer-berg/920613-5170843-prenzlauer-berg-familienkieze-im-nordwes.html' },
  { label: 'Friedenau district profile', href: 'https://www.berlin.de/ba-tempelhof-schoeneberg/politik-und-verwaltung/service-und-organisationseinheiten/koordination-und-beteiligung/bezirksregionen/bzrp_073005-1305939.php' },
  { label: 'Seepark playground reopening', href: 'https://www.berlin.de/ba-lichtenberg/aktuelles/nachrichten/artikel.1449474.php' },
  { label: 'Berlin school directory: Seepark primary school', href: 'https://www.bildung.berlin.de/Schulverzeichnis/Schulportrait.aspx?IDSchulzweig=29800' },
  { label: 'MACHmit! Museum', href: 'https://machmitmuseum.de/' },
  { label: 'Lula am Markt', href: 'https://www.lula-berlin.de/de' },
  { label: 'Café TreBo', href: 'https://www.cafetrebo.de/' },
];

const streetSources: GuideSource[] = [
  { label: 'Berlin: Kantstraße neighborhood walk', href: 'https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/spazieren-und-wandern/kiezspaziergaenge/artikel.1513590.php' },
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

export const guideArticles: GuideArticle[] = [
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
            'My weekend-train shortlist would start with Leipzig and Dresden, then Erfurt. Leipzig has scale and an established cultural pull; Dresden has universities, research and semiconductor jobs; Erfurt has the surprise factor. After those, I’d look selectively at Coburg and towns on the Nuremberg orbit, Koblenz, and individual Ruhr neighborhoods. Saarland can work too, but only when you can name the local employer or cross-border connection doing the heavy lifting. A cheap square metre is not a thesis.',
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
            'Leipzig wins on labor-market depth, culture and the number of neighborhoods with regular buyer demand—but the famous ones already know they are famous. Dresden brings a different strength: universities, research and chip investment. Erfurt is smaller and resale can be slower. Its advantage is centrality, not magic.',
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
      kicker: 'Neighborhood fieldwork · Berlin',
      title: 'Berlin with children: three neighborhoods that work',
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
            'Friedenau feels almost improbably small after central Berlin: short blocks, old street trees and errands that join up without a transport plan. The district profile counts eleven public playgrounds and two public primary schools. Start at Breslauer Platz on market day, pick up bread at Lula am Markt, then wander toward Perelsplatz. It is not a blockbuster afternoon, which is precisely the charm—you are rehearsing a normal Saturday.',
            'Then spoil the idyll on purpose. Cross Hauptstraße, stand beside Bundesallee and walk toward the Ringbahn. Noise and air can change in a block. Ask the school directly about catchments and places; a pin nearby never guarantees admission. Friedenau is best when its calm is real at the exact front door, not just present in the estate agent’s district name.',
          ],
          googleMaps: { query: 'Breslauer Platz Berlin Friedenau', label: 'Open the Friedenau loop in Google Maps' },
          map: {
            query: 'Breslauer Platz Berlin Friedenau',
            label: 'Friedenau: a compact everyday loop', lat: 52.4718, lon: 13.3282,
            places: [
              { name: 'Breslauer Platz', detail: 'Market square and the small center of the neighborhood.', query: 'Breslauer Platz Berlin Friedenau' },
              { name: 'Lula am Markt', detail: 'Bread, coffee and an easy pause while you watch the square.', query: 'Lula am Markt Lauterstrasse 14 Berlin' },
              { name: 'Familienzentrum Friedenau', detail: 'Programs and practical support for local families.', query: 'Familienzentrum Friedenau Berlin' },
              { name: 'Perelsplatz', detail: 'A green pause inside the residential grid.', query: 'Perelsplatz Berlin' },
            ],
          },
        },
        {
          heading: '3. Karlshorst by Seepark: the one people forget to mention',
          paragraphs: [
            'Karlshorst is less polished in photographs and often much easier in real life. Seepark’s playground reopened in 2024 after an expansion to roughly 1,200 m², and the new primary school was planned for more than 430 places. Café TreBo is a proper children’s café rather than a café where children are merely tolerated; Tierpark is the sort of weekend plan that needs no committee meeting.',
            'The catch is hidden in the walk to the S-Bahn. A listing can say “Karlshorst” and still hand you a long daily feeder trip. Trace the route at child-speed, check the tram after 20:00 and ask what nearby construction will look like for the years you expect to live there. The pleasant surprise is space; the risk is paying for connectivity that exists only at the center of the map label.',
          ],
          googleMaps: { query: 'Seepark Karlshorst Berlin', label: 'Open Seepark Karlshorst in Google Maps' },
          map: {
            query: 'Seepark Karlshorst Berlin',
            label: 'Karlshorst: Seepark and the everyday anchors', lat: 52.4812, lon: 13.5275,
            places: [
              { name: 'Seepark playground', detail: 'Expanded play space reopened in 2024.', query: 'Spielplatz Seepark Karlshorst Berlin' },
              { name: 'Seepark primary school', detail: 'New school campus at Blockdammweg 60.', query: 'Seepark Grundschule Blockdammweg 60 Berlin' },
              { name: 'Café TreBo', detail: 'A children’s café where play is part of the plan.', query: 'Cafe TreBo Karlshorst Berlin' },
              { name: 'Potpourri family center', detail: 'Local family programs at Eginhardstraße 9.', query: 'Familienzentrum Potpourri Eginhardstrasse 9 Berlin' },
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
            'Then take the ten-second walk to Café Puck at number 33, open daily from 9 and cheerfully calling itself the neighborhood’s living room. This is cultural proximity you can actually use, not an amenity bullet point. It also means deliveries, students and voices on the pavement. For a viewing, stay until early evening; Maxvorstadt changes volume when lectures finish.',
          ],
          googleMaps: { query: 'Tuerkenstrasse Munich', label: 'Open Türkenstraße in Google Maps' },
          stops: [
            { name: 'Türkentor', detail: 'Free entry; check the seasonal opening hours.', query: 'Tuerkentor Tuerkenstrasse 17 Munich' },
            { name: 'Café Puck', detail: 'Breakfast, coffee and neighborhood life from 9 a.m.', query: 'Cafe Puck Tuerkenstrasse 33 Munich' },
          ],
        },
        {
          heading: 'Hamburg · Schulterblatt',
          paragraphs: [
            'Schulterblatt does not make its contradictions subtle. The Rote Flora—the self-organised, occupied cultural project at what used to be number 71 and is now Achidi-John-Platz 1—has been here since 1989. A few doors away you get brunch queues, bars and polished shopfronts. Don’t flatten that into “edgy charm”; the friction is political history, nightlife and rising commercial pressure sharing one short street.',
            'For a pause, Blattgold at number 83 does vegetarian dinner and a weekend brunch; for serious coffee, detour around the corner to the elbgold roastery in the old Schanzenhöfe on Lagerstraße. Then do the important property-viewing trick: walk one block sideways. Schulterblatt can be loud and public while a nearby residential street feels almost tucked away. That change, over 200 metres, is the real neighborhood review.',
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
            'The former industrial fabric around Ehrenfeld gives the area its texture, but the tracks also give it noise. Look beyond the photogenic shopfronts toward the rail approaches and Körnerpark. A few hundred metres can change both the charm and your sleep, so stand outside the exact building after a train passes before deciding the street is perfect.',
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
