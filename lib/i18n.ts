import { canonicalCondition } from './property-condition.ts';
import { formatAvailabilityDate } from './availability.ts';
import { OSM_ATTRIBUTION } from './osm-map.ts';

export type Locale = 'en' | 'de';

export const isGerman = (locale: Locale) => locale === 'de';

export function localePath(locale: Locale, path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') return normalized;
  return normalized === '/' ? '/de' : `/de${normalized}`;
}

export const copy = {
  en: {
    nav: { approach: 'How it works', faq: 'FAQ', guide: 'Guide', note: 'Independent property reports', country: 'Germany' },
    home: {
      audience: 'FOR THOUGHTFUL HOME BUYERS',
      headline: 'See the home.',
      emphasis: 'Not the sales pitch.',
      start: 'START A PROPERTY REPORT',
      input: 'Paste a property listing URL',
      assess: 'Create report',
      or: 'or',
      upload: 'Upload an Exposé PDF',
      readingListing: 'Reading listing…',
      readingPdf: 'Reading Exposé…',
      genericError: 'The report could not be created.',
      scannedPdf: 'This PDF appears to be scanned. Please upload a text-searchable Exposé.',
      pdfError: 'The PDF could not be read. Try a text-searchable Exposé.',
      approachLabel: 'HOW IT WORKS',
      approachTitle: 'See if the listing deserves a viewing.',
      approachIntro: 'Paste a listing link from a German property portal, or upload the Exposé. One report sets the score, Kaufnebenkosten and Hausgeld next to questions for the seller or agent.',
      steps: [
        ['THE LISTING', 'Bring the source you have', 'Paste a public link or upload the Exposé PDF. If a portal blocks the import, paste the listing text. Price, space, floor, energy and commission are taken from that source; anything missing stays blank.'],
        ['THE REPORT', 'The costs, next to the score', 'A score out of 10 when price, size and place are stated — hidden when those facts are missing or contradict each other. The map uses only the location the listing gives. Try a rough mortgage with your equity, the current German mortgage rate and Tilgung.'],
        ['THE DECISION', 'Questions, then a shortlist', 'Questions written for this home, to ask the seller or agent. Pin what deserves a viewing, compare two homes side by side, and share or print the same brief.'],
      ],
      reportLabel: 'IN THE REPORT',
      reportPoints: [
        ['Hausgeld', 'The monthly fee, when the listing states it'],
        ['Kaufnebenkosten', 'Stated in the listing, or a rough estimate when it omits them'],
        ['Energy', 'Class and heating, when the listing states them'],
        ['Warnings', 'Conflicts and missing facts, in plain language'],
      ],
      approachFree: 'Reports are free.',
      approachFreeNote: 'No sign-up, no subscription.',
      approachCta: 'Start with a listing',
      faqLabel: 'FREQUENTLY ASKED',
      faqTitle: 'A clearer way through the house hunt.',
      faqIntro: 'Practical answers for comparing unclear listings, testing the numbers and deciding what deserves a closer look.',
      faqs: [
        ['How can I make sense of a vague or overly polished property listing?', 'Review a House turns the listing into a structured report: price, price per square metre, size, rooms, floor, building age, energy, heating, condition, light, recurring costs and location signals. Sales language is stripped away, while missing or unclear facts stay visible instead of being guessed.'],
        ['Can I create reports for homes listed on different property platforms?', 'Yes. Paste a public listing URL or upload a text-searchable Exposé PDF. You get one consistent format even when portals describe the same facts in completely different ways. If a portal blocks automated access, the PDF upload is the most reliable route.'],
        ['How can I keep track of properties during a long house hunt?', 'Every report you open is added chronologically to the sidebar in your browser. Pin the strongest candidates to keep them at the top, and remove the ones you have ruled out. Repeating the same listing reuses its existing entry, so your shortlist stays clean.'],
        ['Can I compare two properties side by side?', 'Yes. Select any two saved reports in the sidebar to create a focused comparison. It aligns asking price, purchase costs, price per square metre, size, floor, energy facts, the Review a House score and other key details so the trade-offs are easier to see.'],
        ['Can I share a property report or comparison with other people?', 'Yes. Every report and comparison has its own persistent link. Send it to a partner, friend, family member or adviser so everyone is discussing the same facts and assumptions.'],
        ['How can I quickly tell whether a property deserves a closer look?', 'The Review a House score rates each listing from 0 to 10 on the facts it states: price (only where official local sales prices exist), neighbourhood, space, building, energy, light, running costs and how complete the listing is. Each score shows how much data it rests on. It is a screening tool, not a valuation or a substitute for technical and legal checks.'],
        ['Can I adjust the mortgage estimate to fit my situation?', 'Yes. Change the down payment, mortgage rate and initial repayment rate directly in the report. The estimated loan and monthly payment update immediately. The calculator is deliberately rough, so confirm the final financing and ancillary costs with a lender or adviser.'],
        ['Is Review a House free, and what do the paid plans include?', 'Reports are free, with no daily limit and no sign-up required. A one-off €5 day pass gives you 50 reports for 24 hours with no subscription or automatic renewal. Pro costs €10 per month for 10 reports per day, while Ultra costs €20 per month for up to 100 reports per day.'],
      ],
    },
    sidebar: {
      expand: 'Expand sidebar', collapse: 'Collapse sidebar', newAssessment: 'New report', upgrade: 'Upgrade', dayPass: '€5 day pass', quota: 'Reports are free', todayUsage: 'REPORTS TODAY', passUsage: 'DAY PASS USAGE', remaining: 'remaining', freePlan: 'Free', dayPassName: 'Day pass', loadingUsage: 'Loading usage…',
      yours: 'YOUR REPORTS', empty: 'Your saved reports will appear here.', select: 'Select', pin: 'Pin', unpin: 'Unpin',
      remove: 'Remove from sidebar', removeAssessment: 'Remove report from sidebar', compare: 'Compare selected',
    },
    report: {
      brief: 'REVIEW A HOUSE / PROPERTY REPORT', copyLink: 'Copy share link', copied: 'Link copied', score: 'LISTING RUBRIC',
      deterministic: '', scoreDetails: 'View score details', scoreExplainer: 'A screening rubric based on the facts the listing states, not a valuation or a buying recommendation. Price counts only where we have official local sales prices (Berlin for now). Missing facts lower the confidence, and conflicting facts withhold the score.', scoreWithheld: 'No score while key facts are missing or conflicting.', conflictWithheld: 'Score withheld: the listing contradicts itself on {facts}.', addressWithheld: 'Score withheld: the extracted street is not a valid address.', sourceWithheld: 'Score withheld: this saved report needs a fresh source review.', figuresWithheld: 'Score withheld: the listing does not state a price and a living area.', placeWithheld: 'Score withheld: the listing does not name a town.', typeWithheld: 'Score withheld: the property type is not clear from the listing.', lowConfidence: 'Not enough stated facts for a score ({present} of 8). Ask the seller for the missing details.', missingFacts: 'Missing: {facts}.', priceNotScored: 'not scored (no local price data)', priceNotChecked: 'Price not checked: no local reference data yet', howWeReview: 'How we review', scoreAdjustment: { leasehold: 'Leasehold or leased land: −{points}. The land is not part of the purchase.', rented: 'Rented, open-ended: −{points}.' }, confidenceLevel: { high: 'High', medium: 'Medium', low: 'Low' }, confidenceLine: 'Confidence: {level} · {present} of {total} key facts', asking: 'Asking price', perSqm: 'Price per m²', living: 'Living space', usable: 'Usable space', rooms: 'Rooms', floor: 'Floor', use: 'Rental status', condition: 'Condition', commission: "Buyer's commission", monthly: '/ month', return: 'Advertised return', sun: 'Sun / orientation', daylight: 'Daylight', energy: 'Energy', heating: 'Heating', built: 'Built',
      atGlance: 'AT A GLANCE', profile: 'PROPERTY PROFILE', details: 'LISTING DETAILS', matters: 'WHAT MATTERS', notes: 'DATA NOTES', notDisclosed: 'Not disclosed',
      photosCaption: 'Photos from the listing · opens the original page',
      photoLink: 'Photo {n} of {total}, opens the original listing in a new tab',
      plot: 'Plot area', redFlags: 'RED FLAGS', redFlagsEmpty: 'No red flags found in the listing text. That is not a guarantee, so check the documents.', redFlagSerious: 'Serious', redFlagCheck: 'Check', redFlagFrom: 'From the listing:',
      components: { price: 'Price', neighborhood: 'Neighbourhood', space: 'Space', building: 'Building', energy: 'Energy', light: 'Light', costs: 'Costs', source: 'Source' },
      source: 'SOURCE', original: 'View original listing ↗', downloadPdf: 'Download PDF ↓', saved: 'Report saved', assessMore: 'CREATE MORE REPORTS', plansTitle: 'Keep the decision process moving.', plansCopy: 'Reports are free, with no daily limit. No sign-up, and no subscription required.', perMonth: '/month', proLimit: '10 reports per day', ultraLimit: '100 reports per day', proButton: 'Upgrade to Pro', ultraButton: 'Choose Ultra',
    },
    finance: {
      label: 'FINANCING SCENARIO', knownOutlay: 'Known monthly outlay before rent', payment: 'Illustrative loan payment', loan: 'Loan', purchase: 'Purchase price', buyerCosts: 'Buyer costs', estimatedBuyerCosts: 'Estimated buyer costs', total: 'Total cost', equity: 'Equity / down payment', rate: 'Mortgage rate', repayment: 'Initial repayment (Tilgung)', includeHousegeld: 'Include Hausgeld', rateLoading: "Loading today's mortgage rate…", rateUnavailable: 'Current mortgage rates are unavailable right now', note: 'Starts with the current FMH average effective rate for a 10-year German mortgage. Illustrative annuity calculation, not a financing offer. Hausgeld is shown gross when included; for a rented unit, verify the recoverable and owner-only portions. Confirm the final rate, costs and affordability with a lender.', houseNote: 'Starts with the current FMH average effective rate for a 10-year German mortgage. Illustrative annuity calculation, not a financing offer. Confirm the final rate, costs and affordability with a lender.',
    },
    questions: { label: 'ASK BEFORE YOU OFFER', reviewing: 'Reviewing listing', tailored: 'Tailored to this listing', core: '', title: 'Questions worth asking', note: '' },
    map: { label: 'NEIGHBOURHOOD', intro: 'Use the map to verify walking routes to U-Bahn, S-Bahn, trams, parks and daily essentials—not just straight-line distance.', loading: 'Locating the neighbourhood…', explore: 'Explore on OpenStreetMap ↗', approximate: 'The listing does not disclose an exact address. The map is centred on the most precise stated area:', exact: 'The listing provides an exact street address.', credit: OSM_ATTRIBUTION },
    compare: { label: 'PROPERTY COMPARISON', title: 'Two properties, side by side.', property: 'PROPERTY', option: 'OPTION', address: 'Address', neighborhood: 'Neighbourhood', asking: 'Asking price', acquisition: 'Total acquisition cost', commission: "Buyer's commission", perSqm: 'Price per living m²', living: 'Living space', usable: 'Usable space', rooms: 'Rooms', floor: 'Floor', use: 'Rental status', condition: 'Condition', housegeld: 'Hausgeld', monthly: '/ month', return: 'Advertised return', energy: 'Energy', redFlags: 'Red flags', score: 'Listing rubric', mixedPrice: 'These scores are not directly comparable: one price was checked against local sales and the other was not.' },
    ads: { partner: 'PARTNER SPACE', note: 'A quiet place for a useful partner—not a distraction.', finance: 'Financing, survey or buyer-service partner', local: 'Local agent, architect or home partner' },
  },
  de: {
    nav: { approach: 'So funktioniert’s', faq: 'FAQ', guide: 'Guide', note: 'Klare Immobilien-Berichte', country: 'Deutschland' },
    home: {
      audience: 'FÜR ALLE, DIE GENAUER HINSCHAUEN',
      headline: 'Sieh das Zuhause.',
      emphasis: 'Nicht den Verkaufstext.',
      start: 'BERICHT ERSTELLEN',
      input: 'Link zu einem Immobilienangebot einfügen',
      assess: 'Bericht erstellen',
      or: 'oder',
      upload: 'Exposé als PDF hochladen',
      readingListing: 'Angebot wird gelesen…',
      readingPdf: 'Exposé wird gelesen…',
      genericError: 'Der Bericht konnte nicht erstellt werden.',
      scannedPdf: 'Das PDF scheint eingescannt zu sein. Bitte lade ein durchsuchbares Exposé hoch.',
      pdfError: 'Das PDF konnte nicht gelesen werden. Versuch es mit einem durchsuchbaren Exposé.',
      approachLabel: 'SO FUNKTIONIERT’S',
      approachTitle: 'Sieh, ob das Angebot eine Besichtigung verdient.',
      approachIntro: 'Füge einen Inserat-Link von einem deutschen Immobilienportal ein oder lade das Exposé hoch. Ein Bericht stellt den Score, die Kaufnebenkosten und das Hausgeld neben die Fragen an Verkäufer oder Makler.',
      steps: [
        ['DAS INSERAT', 'Die Quelle, die du schon hast', 'Füge einen öffentlichen Link ein oder lade das Exposé als PDF hoch. Blockiert ein Portal den Import, füge den Angebotstext ein. Preis, Fläche, Etage, Energie und Provision kommen aus dieser Quelle; was fehlt, bleibt leer.'],
        ['DER BERICHT', 'Die Kosten neben dem Score', 'Ein Score bis 10, wenn Preis, Größe und Lage genannt sind. Fehlen diese Angaben oder widersprechen sie sich, bleibt der Score aus. Die Karte zeigt nur die Lage aus dem Angebot. Die Finanzierung ist eine grobe Rechnung mit Eigenkapital, aktuellem Bauzins und Tilgung.'],
        ['DIE ENTSCHEIDUNG', 'Fragen, dann die engere Wahl', 'Fragen, die zu dieser Immobilie passen, für Verkäufer oder Makler. Pinne, was eine Besichtigung verdient, vergleiche zwei Angebote und teile oder drucke dieselbe Übersicht.'],
      ],
      reportLabel: 'IM BERICHT',
      reportPoints: [
        ['Hausgeld', 'Der Monatsbeitrag, wenn das Angebot ihn nennt'],
        ['Kaufnebenkosten', 'Aus dem Angebot, sonst eine grobe Schätzung'],
        ['Energie', 'Klasse und Heizung, soweit das Angebot sie nennt'],
        ['Hinweise', 'Widersprüche und fehlende Angaben, in klaren Worten'],
      ],
      approachFree: 'Berichte sind kostenlos.',
      approachFreeNote: 'Ohne Anmeldung, ohne Abo.',
      approachCta: 'Mit einem Inserat starten',
      faqLabel: 'HÄUFIGE FRAGEN',
      faqTitle: 'Entspannter durch die Immobiliensuche.',
      faqIntro: 'Kurze Antworten für unklare Angebote, den Zahlencheck und die Frage, welche Immobilie wirklich einen zweiten Blick verdient.',
      faqs: [
        ['Wie bekomme ich aus einem schwammigen Immobilienangebot die wichtigen Fakten heraus?', 'Review a House macht aus dem Angebot einen klaren Bericht: Preis, Preis pro Quadratmeter, Größe, Zimmer, Etage, Baujahr, Energie, Heizung, Zustand, Licht, laufende Kosten und Lage. Werbesätze fliegen raus. Fehlende oder unklare Angaben bleiben sichtbar, statt einfach ergänzt zu werden.'],
        ['Kann ich Angebote von verschiedenen Immobilienportalen prüfen?', 'Ja. Füge einen öffentlichen Link ein oder lade ein durchsuchbares Exposé als PDF hoch. So sehen Angebote aus ganz unterschiedlichen Portalen immer gleich aus. Falls ein Portal den automatischen Zugriff blockiert, klappt es meist am zuverlässigsten mit dem PDF.'],
        ['Wie behalte ich bei einer längeren Immobiliensuche den Überblick?', 'Jeder geöffnete Bericht wird in deinem Browser chronologisch in der Seitenleiste gespeichert. Gute Kandidaten kannst du oben anpinnen, aussortierte wieder entfernen. Dasselbe Angebot wird nicht doppelt angelegt, damit die Liste sauber bleibt.'],
        ['Kann ich zwei Immobilien direkt vergleichen?', 'Ja. Wähle in der Seitenleiste zwei gespeicherte Berichte aus. Die Vergleichsansicht stellt Kaufpreis, Nebenkosten, Quadratmeterpreis, Größe, Etage, Energie, den Review-a-House-Score und weitere wichtige Angaben direkt nebeneinander.'],
        ['Kann ich einen Bericht oder Vergleich mit anderen teilen?', 'Ja. Jeder Bericht und jeder Vergleich hat einen festen Link. Schick ihn an Partner, Freunde, Familie oder deine Beratung – dann sprechen alle über dieselben Fakten und Annahmen.'],
        ['Wie sehe ich schnell, ob sich ein genauerer Blick lohnt?', 'Der Review-a-House-Score bewertet jedes Angebot von 0 bis 10 anhand seiner Angaben: Preis (nur wo amtliche lokale Kaufpreise vorliegen), Lage, Platz, Gebäude, Energie, Licht, laufende Kosten und Vollständigkeit. Jeder Score zeigt, auf wie vielen Angaben er beruht. Er ist ein Filter, kein Wertgutachten und kein Ersatz für technische oder rechtliche Prüfung.'],
        ['Kann ich die grobe Finanzierung an meine Situation anpassen?', 'Ja. Eigenkapital, Zinssatz und anfängliche Tilgung lassen sich direkt im Bericht ändern. Darlehen und Monatsrate passen sich sofort an. Die Rechnung ist bewusst grob – finale Kosten und Konditionen solltest du mit einer Bank oder Beratung prüfen.'],
        ['Ist Review a House kostenlos und was bringen die Bezahlpakete?', 'Berichte sind kostenlos, ohne Tageslimit und ohne Anmeldung. Ein Tagespass kostet einmalig 5 € für 50 Berichte in 24 Stunden, ohne Abo oder automatische Verlängerung. Pro kostet 10 € im Monat für 10 Berichte pro Tag, Ultra kostet 20 € im Monat für bis zu 100 Berichte pro Tag.'],
      ],
    },
    sidebar: {
      expand: 'Seitenleiste öffnen', collapse: 'Seitenleiste schließen', newAssessment: 'Neuer Bericht', upgrade: 'Upgrade', dayPass: '5-€-Tagespass', quota: 'Berichte sind kostenlos', todayUsage: 'BERICHTE HEUTE', passUsage: 'TAGESPASS-NUTZUNG', remaining: 'übrig', freePlan: 'Kostenlos', dayPassName: 'Tagespass', loadingUsage: 'Nutzung wird geladen…',
      yours: 'DEINE BERICHTE', empty: 'Deine gespeicherten Berichte erscheinen hier.', select: 'Auswählen', pin: 'Anpinnen', unpin: 'Loslösen',
      remove: 'Aus Seitenleiste entfernen', removeAssessment: 'Bericht aus Seitenleiste entfernen', compare: 'Auswahl vergleichen',
    },
    report: {
      brief: 'REVIEW A HOUSE / IMMOBILIEN-BERICHT', copyLink: 'Link kopieren', copied: 'Link kopiert', score: 'ANGEBOTSRASTER',
      deterministic: '', scoreDetails: 'Score-Details ansehen', scoreExplainer: 'Ein Prüfraster auf Basis der Angaben im Angebot, kein Wertgutachten und keine Kaufempfehlung. Der Preis zählt nur, wo amtliche lokale Kaufpreise vorliegen (vorerst Berlin). Fehlende Angaben senken die Verlässlichkeit, Widersprüche verhindern den Score.', scoreWithheld: 'Kein Score, solange wichtige Angaben fehlen oder sich widersprechen.', conflictWithheld: 'Kein Score: Das Angebot widerspricht sich {facts}.', addressWithheld: 'Kein Score: Die erkannte Straße ist keine gültige Adresse.', sourceWithheld: 'Kein Score: Dieser gespeicherte Bericht braucht eine neue Quellenprüfung.', figuresWithheld: 'Kein Score: Das Angebot nennt keinen Kaufpreis und keine Wohnfläche.', placeWithheld: 'Kein Score: Das Angebot nennt keinen Ort.', typeWithheld: 'Kein Score: Die Objektart geht aus dem Angebot nicht klar hervor.', lowConfidence: 'Zu wenige Angaben für einen Score ({present} von 8). Frag beim Verkäufer nach den fehlenden Angaben.', missingFacts: 'Es fehlen: {facts}.', priceNotScored: 'nicht bewertet (keine lokalen Preisdaten)', priceNotChecked: 'Preis nicht geprüft: noch keine lokalen Vergleichsdaten', howWeReview: 'So prüfen wir', scoreAdjustment: { leasehold: 'Erbbaurecht oder Pachtgrundstück: −{points}. Das Grundstück gehört nicht zum Kauf.', rented: 'Vermietet, unbefristet: −{points}.' }, confidenceLevel: { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' }, confidenceLine: 'Verlässlichkeit: {level} · {present} von {total} Kernangaben', asking: 'Kaufpreis', perSqm: 'Preis pro m²', living: 'Wohnfläche', usable: 'Nutzfläche', rooms: 'Zimmer', floor: 'Etage', use: 'Mietstatus', condition: 'Zustand', commission: 'Käuferprovision', monthly: '/ Monat', return: 'Angegebene Rendite', sun: 'Sonne / Ausrichtung', daylight: 'Tageslicht', energy: 'Energie', heating: 'Heizung', built: 'Baujahr',
      atGlance: 'AUF EINEN BLICK', profile: 'IMMOBILIENPROFIL', details: 'ANGABEN IM EXPOSÉ', matters: 'WAS WICHTIG IST', notes: 'HINWEISE ZU DEN DATEN', notDisclosed: 'Nicht angegeben',
      photosCaption: 'Fotos aus dem Angebot · öffnet die Originalseite',
      photoLink: 'Foto {n} von {total}, öffnet das Originalangebot in einem neuen Tab',
      plot: 'Grundstücksfläche', redFlags: 'WARNSIGNALE', redFlagsEmpty: 'Im Angebotstext keine Warnsignale gefunden. Das ist keine Garantie, prüfe die Unterlagen.', redFlagSerious: 'Ernst', redFlagCheck: 'Prüfen', redFlagFrom: 'Aus dem Angebot:',
      components: { price: 'Preis', neighborhood: 'Lage', space: 'Platz', building: 'Gebäude', energy: 'Energie', light: 'Licht', costs: 'Kosten', source: 'Quelle' },
      source: 'QUELLE', original: 'Originalangebot öffnen ↗', downloadPdf: 'PDF herunterladen ↓', saved: 'Bericht gespeichert', assessMore: 'MEHR BERICHTE ERSTELLEN', plansTitle: 'Bleib bei deiner Suche im Fluss.', plansCopy: 'Berichte sind kostenlos, ohne Tageslimit. Ohne Anmeldung und ohne Abo.', perMonth: '/Monat', proLimit: '10 Berichte pro Tag', ultraLimit: '100 Berichte pro Tag', proButton: 'Pro wählen', ultraButton: 'Ultra wählen',
    },
    finance: {
      label: 'BAUFINANZIERUNGSRECHNER', knownOutlay: 'Bekannte Monatskosten vor Mieteinnahmen', payment: 'Grobe monatliche Kreditrate', loan: 'Darlehen', purchase: 'Kaufpreis', buyerCosts: 'Kaufnebenkosten', estimatedBuyerCosts: 'Geschätzte Kaufnebenkosten', total: 'Gesamtkosten', equity: 'Eigenkapital', rate: 'Kalkulationszins', repayment: 'Anfängliche Tilgung', includeHousegeld: 'Hausgeld einrechnen', rateLoading: 'Aktueller Bauzins wird geladen…', rateUnavailable: 'Aktuelle Bauzinsen sind gerade nicht verfügbar', note: 'Startet mit dem aktuellen durchschnittlichen FMH-Effektivzins für eine zehnjährige Baufinanzierung in Deutschland. Grobe Annuitätenrechnung, kein Finanzierungsangebot. Das Hausgeld ist brutto eingerechnet, wenn ausgewählt; bei vermieteten Wohnungen den umlagefähigen und den eigenen Anteil prüfen. Finale Konditionen, Kosten und Leistbarkeit bitte mit einer Bank klären.', houseNote: 'Startet mit dem aktuellen durchschnittlichen FMH-Effektivzins für eine zehnjährige Baufinanzierung in Deutschland. Grobe Annuitätenrechnung, kein Finanzierungsangebot. Finale Konditionen, Kosten und Leistbarkeit bitte mit einer Bank klären.',
    },
    questions: { label: 'VOR DEM ANGEBOT FRAGEN', reviewing: 'Angebot wird geprüft', tailored: 'Auf dieses Angebot zugeschnitten', core: '', title: 'Fragen, die sich lohnen', note: '' },
    map: { label: 'LAGE', intro: 'Prüfe auf der Karte echte Wege zu U-Bahn, S-Bahn, Tram, Parks und Dingen des täglichen Lebens – nicht nur die Luftlinie.', loading: 'Lage wird gesucht…', explore: 'Auf OpenStreetMap öffnen ↗', approximate: 'Im Angebot steht keine genaue Adresse. Die Karte zeigt den genauesten genannten Bereich:', exact: 'Im Angebot steht eine genaue Straßenadresse.', credit: OSM_ATTRIBUTION },
    compare: { label: 'IMMOBILIENVERGLEICH', title: 'Zwei Immobilien, direkt nebeneinander.', property: 'IMMOBILIE', option: 'OPTION', address: 'Adresse', neighborhood: 'Stadtteil', asking: 'Kaufpreis', acquisition: 'Gesamte Kaufkosten', commission: 'Käuferprovision', perSqm: 'Preis pro Wohn-m²', living: 'Wohnfläche', usable: 'Nutzfläche', rooms: 'Zimmer', floor: 'Etage', use: 'Mietstatus', condition: 'Zustand', housegeld: 'Hausgeld', monthly: '/ Monat', return: 'Angegebene Rendite', energy: 'Energie', redFlags: 'Warnsignale', score: 'Angebotsraster', mixedPrice: 'Diese Scores sind nicht direkt vergleichbar: Ein Preis wurde mit lokalen Verkäufen geprüft, der andere nicht.' },
    ads: { partner: 'PLATZ FÜR PARTNER', note: 'Ein ruhiger Platz für einen hilfreichen Partner – ohne Ablenkung.', finance: 'Finanzierung, Gutachten oder Kaufberatung', local: 'Makler, Architekt oder Partner fürs Zuhause' },
  },
} as const;

const hiddenPlanFaq = {
  en: ['Is Review a House free?', 'Yes. Reports are free, with no daily limit and no sign-up.'],
  de: ['Ist Review a House kostenlos?', 'Ja. Berichte sind kostenlos, ohne Tageslimit und ohne Anmeldung.'],
} as const;

export function homePresentation(locale: Locale, paidPlansOffered: boolean) {
  const home = copy[locale].home;
  if (paidPlansOffered) return home;
  return {
    ...home,
    faqs: home.faqs.map((entry, index) => (index === home.faqs.length - 1 ? hiddenPlanFaq[locale] : entry)),
  };
}

export function financeFootnote(propertyType: string, locale: Locale) {
  const finance = copy[locale].finance;
  return propertyType === 'house' ? finance.houseNote : finance.note;
}

const ENERGY_PHRASES: Array<[RegExp, string]> = [
  [/luft\s*[-/]\s*wasser\s*[-]?\s*w[aä]rme(?:pumpe)?/gi, 'Air-to-water heat pump'],
  [/sole\s*[-/]\s*wasser\s*[-]?\s*w[aä]rmepumpe/gi, 'Brine-to-water heat pump'],
  [/wasser\s*[-/]\s*wasser\s*[-]?\s*w[aä]rmepumpe/gi, 'Water-to-water heat pump'],
  [/luft\s*[-]?\s*w[aä]rmepumpe/gi, 'Air-source heat pump'],
  [/erd\s*[-]?\s*w[aä]rmepumpe/gi, 'Ground-source heat pump'],
  [/blockheizkraftwerk/gi, 'Combined heat and power system'],
  [/fußbodenheizung|fussbodenheizung/gi, 'Underfloor heating'],
  [/nachtspeicher(?:heizung)?/gi, 'Night-storage heating'],
  [/etagenheizung/gi, 'Individual heating system'],
  [/zentralheizung/gi, 'Central heating'],
  [/gasheizung/gi, 'Gas heating'],
  [/ölheizung|oelheizung/gi, 'Oil heating'],
  [/pelletheizung/gi, 'Pellet heating'],
  [/fernw[aä]rme/gi, 'District heating'],
  [/nahw[aä]rme/gi, 'Local district heating'],
  [/umweltw[aä]rme/gi, 'Ambient heat'],
  [/erdw[aä]rme|geothermie/gi, 'Geothermal energy'],
  [/luftw[aä]rme/gi, 'Air-source heat'],
  [/wärmepumpe|waermepumpe/gi, 'Heat pump'],
  [/erdgas/gi, 'Natural gas'],
  [/heizöl|heizoel/gi, 'Heating oil'],
  [/flüssiggas|fluessiggas/gi, 'LPG'],
  [/holzpellets/gi, 'Wood pellets'],
  [/solarthermie/gi, 'Solar thermal'],
  [/elektroheizung/gi, 'Electric heating'],
];

const EXACT_ENERGY: Record<string, string> = {
  öl: 'Oil', oel: 'Oil', gas: 'Gas', strom: 'Electricity', holz: 'Wood', kohle: 'Coal', pellets: 'Pellets', solar: 'Solar',
};

/** English gloss for a German heating or energy-carrier label. Empty when nothing matched. */
export function translateEnergyPhrase(value: string) {
  const exact = EXACT_ENERGY[value.trim().toLocaleLowerCase('de-DE')];
  if (exact) return exact;
  let next = value;
  let changed = false;
  for (const [pattern, english] of ENERGY_PHRASES) {
    const expression = new RegExp(pattern.source, 'gi');
    if (!expression.test(next)) continue;
    changed = true;
    next = next.replace(new RegExp(pattern.source, 'gi'), english);
  }
  return changed ? next.replace(/\s{2,}/g, ' ').trim() : '';
}

export function localizedValue(value: string | undefined, locale: Locale) {
  if (!value || /not stated|unknown|address not stated/i.test(value)) return copy[locale].report.notDisclosed;
  const legacyNotRented = ['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(value);
  const condition = canonicalCondition(value);
  const normalized = condition || value;
  if (normalized === 'Commission-free') {
    return locale === 'de' ? 'Provisionsfrei / keine Käuferprovision' : "Commission-free / no buyer's commission";
  }
  if (locale === 'en') {
    if (legacyNotRented) return 'Not rented';
    if (/(?:viel|reichlich)\s+Tageslicht/i.test(normalized)) return 'Abundant daylight, as the listing states';
    const floor = normalized.match(/^(\d+)\.\s*OG$/i);
    if (floor) {
      const number = Number(floor[1]);
      const suffix = number % 100 >= 11 && number % 100 <= 13 ? 'th' : number % 10 === 1 ? 'st' : number % 10 === 2 ? 'nd' : number % 10 === 3 ? 'rd' : 'th';
      return `${number}${suffix} floor`;
    }
    const englishTranslations: Record<string, string> = {
      Erstbezug: 'First occupancy',
      EG: 'Ground floor', Erdgeschoss: 'Ground floor', Hochparterre: 'Raised ground floor', Souterrain: 'Lower ground floor', DG: 'Top floor', Dachgeschoss: 'Top floor',
      Etagenheizung: 'Individual heating system', Zentralheizung: 'Central heating', Fernwärme: 'District heating', Gasheizung: 'Gas heating', Ölheizung: 'Oil heating', Wärmepumpe: 'Heat pump',
      Fußbodenheizung: 'Underfloor heating', Nachtspeicherheizung: 'Night-storage heating', Pelletheizung: 'Pellet heating', Blockheizkraftwerk: 'Combined heat and power system',
      'Luft-/Wasserwärme': 'Air-to-water heat pump', 'Luft-Wasser-Wärmepumpe': 'Air-to-water heat pump', 'Luft/Wasser-Wärmepumpe': 'Air-to-water heat pump',
      Luftwärmepumpe: 'Air-source heat pump', Erdwärmepumpe: 'Ground-source heat pump', Umweltwärme: 'Ambient heat',
      Erdwärme: 'Geothermal energy', Luftwärme: 'Air-source heat', Nahwärme: 'Local district heating', Erdgas: 'Natural gas', Heizöl: 'Heating oil',
      'Timber frame': 'Timber frame',
      'Needs modernization': 'Needs modernisation',
    };
    return englishTranslations[normalized] || translateEnergyPhrase(normalized) || normalized.replace(/\binkl\.?\s*(?:gesetzl\.?)?\s*MwSt\.?/giu, 'incl. VAT');
  }
  const translations: Record<string, string> = {
    'First occupancy': 'Erstbezug',
    Rented: 'Vermietet', 'Not rented': 'Nicht vermietet', Vacant: 'Nicht vermietet', 'Owner-occupied': 'Nicht vermietet',
    'Available to move in': 'Nicht vermietet', 'Needs renovation': 'Renovierungsbedürftig', 'Needs modernization': 'Modernisierungsbedürftig',
    'Under construction': 'Im Bau', 'New build': 'Neubau', Renovated: 'Renoviert', 'Like new': 'Neuwertig', 'Well maintained': 'Gepflegt',
    'Timber frame': 'Holzbau', 'Luft-/Wasserwärme': 'Luft-/Wasserwärme',
      'Floor-to-ceiling windows; abundant daylight claimed': 'Bodentiefe Fenster; viel Tageslicht laut Angebot',
      'Abundant daylight, as the listing states': 'Viel Tageslicht laut Angebot',
      'Sunny balcony stated': 'Sonniger Balkon laut Exposé',
  };
  return translations[normalized] || normalized;
}

export function localizedTenancy(value: string | undefined, availabilityDate: string | undefined, locale: Locale) {
  if (value === 'Occupancy unclear') return locale === 'de' ? 'Bewohnung ungeklärt' : 'Occupancy unclear';
  const date = formatAvailabilityDate(availabilityDate, locale);
  if (value === 'Rented' && date) return locale === 'de' ? `Vermietet, frei ab ${date}` : `Rented, free from ${date}`;
  if (date) return locale === 'de' ? `Bezugsfrei ab ${date}` : `Available from ${date}`;
  return localizedValue(value, locale);
}

const featureTranslations = [
  ['Tiefgaragenstellplatz', 'Underground parking space'],
  ['Waschmaschinenanschluss', 'Washing-machine connection'],
  ['Fußbodenheizung', 'Underfloor heating'],
  ['Gemeinschaftsgarten', 'Shared garden'],
  ['Kellerabteil', 'Basement storage unit'],
  ['Kellerraum', 'Basement storage room'],
  ['Dielenboden', 'Wooden floorboards'],
  ['Teppichboden', 'Carpet flooring'],
  ['Vinylboden', 'Vinyl flooring'],
  ['Dachterrasse', 'Roof terrace'],
  ['Einbauküche', 'Fitted kitchen'],
  ['rollstuhlgerecht', 'Wheelchair accessible'],
  ['barrierefrei', 'Step-free access'],
  ['Abstellraum', 'Storage room'],
  ['Gäste-WC', 'Guest WC'],
  ['Gäste WC', 'Guest WC'],
  ['Vollbad', 'Bathroom with bathtub'],
  ['Duschbad', 'Bathroom with shower'],
  ['Badewanne', 'Bathtub'],
  ['Fahrstuhl', 'Lift'],
  ['Aufzug', 'Lift'],
  ['möbliert', 'Furnished'],
  ['Keller', 'Basement / cellar'],
  ['Laminat', 'Laminate flooring'],
  ['Fliesen', 'Tiled flooring'],
  ['Parkett', 'Parquet flooring'],
  ['Balkon', 'Balcony'],
  ['Loggia', 'Loggia'],
  ['Terrasse', 'Terrace'],
  ['Garten', 'Garden'],
  ['Tiefgarage', 'Underground parking'],
  ['Stellplatz', 'Parking space'],
  ['Garage', 'Garage'],
  ['Dachboden', 'Attic storage'],
  ['Dusche', 'Shower'],
  ['Sauna', 'Sauna'],
] as const;

const featureTermPattern = featureTranslations
  .map(([term]) => term)
  .sort((a, b) => b.length - a.length)
  .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const featureTermMatcher = new RegExp(`(?<![\\p{L}\\p{N}])(${featureTermPattern})(?![\\p{L}\\p{N}])`, 'giu');
const featureTranslationsByTerm = new Map(featureTranslations.map(([german, english]) => [german.toLocaleLowerCase('de-DE'), english]));

function splitFeatureTerms(feature: string) {
  const matches = [...feature.matchAll(featureTermMatcher)].map(match => match[0]);
  if (matches.length < 2) return [feature];
  const remainder = feature
    .replace(featureTermMatcher, ' ')
    .replace(/\b(?:und|oder|mit)\b/giu, ' ')
    .replace(/[\s,;·|/+&–—-]+/g, '');
  return remainder ? [feature] : matches;
}

function englishFeature(feature: string) {
  let translated = feature.replace(featureTermMatcher, term => featureTranslationsByTerm.get(term.toLocaleLowerCase('de-DE')) || term);
  if (translated !== feature) {
    translated = translated.replace(/\bund\b/giu, 'and').replace(/\bmit\b/giu, 'with').replace(/\bohne\b/giu, 'without');
  }
  return translated;
}

export function localizedFeatures(features: string[] | undefined, locale: Locale) {
  if (!features?.length) return [];
  // Older saved reports may still contain a decorative section heading that
  // followed an "Ausstattung" label in the source PDF. Keep headings and
  // label/value metadata out of Listing details at render time as well.
  const separated = features
    .filter(feature => {
      const clean = feature.replace(/^[\s*•\-–—]+|[\s*•\-–—]+$/g, '').trim();
      return clean.length >= 2
        && !/[★☆]/u.test(clean)
        && !/[?:]\s*/u.test(clean)
        && !/^(?:wichtiges\s+auf\s+einen\s+blick|auf\s+einen\s+blick|ausstattung|objektdetails|listing\s+details|at\s+a\s+glance|highlights?)$/iu.test(clean);
    })
    .flatMap(splitFeatureTerms);
  return locale === 'en' ? separated.map(englishFeature) : separated;
}
