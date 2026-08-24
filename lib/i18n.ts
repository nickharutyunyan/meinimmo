export type Locale = 'en' | 'de';

export const isGerman = (locale: Locale) => locale === 'de';

export function localePath(locale: Locale, path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') return normalized;
  return normalized === '/' ? '/de' : `/de${normalized}`;
}

export const copy = {
  en: {
    nav: { approach: 'Our approach', faq: 'FAQ', guide: 'Guide', note: 'Independent property reports', country: 'Germany' },
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
      approachLabel: 'OUR APPROACH',
      approachTitle: 'Less brochure. More due diligence.',
      steps: [
        ['Read the source', 'We validate the listing and keep marketing claims separate from stated facts.'],
        ['Build the report', 'Price, costs, location and building details are structured into one calm view.'],
        ['Prepare the questions', 'Missing evidence becomes a useful question for the seller, agent or WEG.'],
      ],
      faqLabel: 'FREQUENTLY ASKED',
      faqTitle: 'A clearer way through the house hunt.',
      faqIntro: 'Practical answers for comparing unclear listings, testing the numbers and deciding what deserves a closer look.',
      faqs: [
        ['How can I make sense of a vague or overly polished property listing?', 'Review a House turns the listing into a structured report: price, price per square metre, size, rooms, floor, building age, energy, heating, condition, light, recurring costs and location signals. Sales language is stripped away, while missing or unclear facts stay visible instead of being guessed.'],
        ['Can I create reports for homes listed on different property platforms?', 'Yes. Paste a public listing URL or upload a text-searchable Exposé PDF. You get one consistent format even when portals describe the same facts in completely different ways. If a portal blocks automated access, the PDF upload is the most reliable route.'],
        ['How can I keep track of properties during a long house hunt?', 'Every report you open is added chronologically to the sidebar in your browser. Pin the strongest candidates to keep them at the top, and remove the ones you have ruled out. Repeating the same listing reuses its existing entry, so your shortlist stays clean.'],
        ['Can I compare two properties side by side?', 'Yes. Select any two saved reports in the sidebar to create a focused comparison. It aligns asking price, purchase costs, price per square metre, size, floor, energy facts, the Review a House score and other key details so the trade-offs are easier to see.'],
        ['Can I share a property report or comparison with other people?', 'Yes. Every report and comparison has its own persistent link. Send it to a partner, friend, family member or adviser so everyone is discussing the same facts and assumptions.'],
        ['How can I quickly tell whether a property deserves a closer look?', 'The Review a House score gives every property a consistent rating out of 10 for quick filtering. It weighs price, neighbourhood, space, building, energy, natural light, costs and source quality, and shows the components behind the result. It is a screening tool—not a formal valuation or a substitute for technical and legal due diligence.'],
        ['Can I adjust the mortgage estimate to fit my situation?', 'Yes. Change the down payment, mortgage rate and initial repayment rate directly in the report. The estimated loan and monthly payment update immediately. The calculator is deliberately rough, so confirm the final financing and ancillary costs with a lender or adviser.'],
        ['Is Review a House free, and what do the paid plans include?', 'You can create two reports per day for free. Pro costs €10 per month and raises the allowance to 10 reports per day. Ultra costs €20 per month and allows up to 100 reports per day. The paid tiers simply increase the daily report allowance.'],
      ],
    },
    sidebar: {
      expand: 'Expand sidebar', collapse: 'Collapse sidebar', newAssessment: 'New report', upgrade: 'Upgrade', quota: '2 free reports daily',
      yours: 'YOUR REPORTS', empty: 'Your saved reports will appear here.', select: 'Select', pin: 'Pin', unpin: 'Unpin',
      remove: 'Remove from sidebar', removeAssessment: 'Remove report from sidebar', compare: 'Compare selected',
    },
    report: {
      brief: 'REVIEW A HOUSE / PROPERTY REPORT', copyLink: 'Copy share link', copied: 'Link copied', score: 'OUR SCORE',
      deterministic: 'Built consistently from listing facts', scoreDetails: 'View score details', scoreExplainer: 'The score combines the property details below using the same rules for every report.', asking: 'Asking price', perSqm: 'Price per m²', living: 'Living space', usable: 'Usable space', rooms: 'Rooms', floor: 'Floor', use: 'Current use', monthly: '/ month', return: 'Advertised return', sun: 'Sun / orientation', daylight: 'Daylight', energy: 'Energy', heating: 'Heating', built: 'Built',
      atGlance: 'AT A GLANCE', details: 'LISTING DETAILS', matters: 'WHAT MATTERS', notes: 'DATA NOTES', notDisclosed: 'Not disclosed',
      components: { price: 'Price', neighborhood: 'Neighborhood', space: 'Space', building: 'Building', energy: 'Energy', light: 'Light', costs: 'Costs', source: 'Source' },
      source: 'SOURCE', original: 'View original listing ↗', saved: 'Report saved', assessMore: 'CREATE MORE REPORTS', plansTitle: 'Keep the decision process moving.', plansCopy: 'Two reports per day are free. Upgrade when you are actively searching.', perMonth: '/month', proLimit: '10 reports per day', ultraLimit: '100 reports per day', proButton: 'Upgrade to Pro', ultraButton: 'Choose Ultra',
    },
    finance: {
      label: 'FINANCING SCENARIO', knownOutlay: 'Known monthly outlay before rent', payment: 'Illustrative loan payment', loan: 'Loan', purchase: 'Purchase price', buyerCosts: 'Buyer costs', total: 'Total cost', equity: 'Equity / down payment', rate: 'Mortgage rate', repayment: 'Initial repayment (Tilgung)', note: 'Illustrative annuity calculation, not a financing offer. Hausgeld is shown gross; for a rented unit, verify the recoverable and owner-only portions. Confirm the rate, buyer-cost assumptions and affordability with a lender.',
    },
    questions: { label: 'ASK BEFORE YOU OFFER', reviewing: 'Reviewing listing', tailored: 'Tailored to this listing', core: 'Core due diligence', title: 'Questions worth getting in writing', note: 'Answers and supporting documents matter more than verbal assurances.' },
    map: { label: 'NEIGHBORHOOD', intro: 'Use the map to verify walking routes to U-Bahn, S-Bahn, trams, parks and daily essentials—not just straight-line distance.', loading: 'Locating the neighborhood…', explore: 'Explore on OpenStreetMap ↗', approximate: 'The listing does not disclose an exact address. The map is centered on the most precise stated area:', exact: 'The listing provides an exact street address.' },
    compare: { label: 'PROPERTY COMPARISON', title: 'Two homes, side by side.', intro: 'A calm view of the facts that change a decision.', property: 'PROPERTY', option: 'OPTION', asking: 'Asking price', acquisition: 'Total acquisition cost', perSqm: 'Price per living m²', living: 'Living space', usable: 'Usable space', rooms: 'Rooms', floor: 'Floor', use: 'Current use', housegeld: 'Hausgeld', monthly: '/ month', return: 'Advertised return', energy: 'Energy', score: 'Our score' },
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
      approachTitle: 'Weniger Verkaufstext. Mehr Klarheit.',
      steps: [
        ['Quelle lesen', 'Wir prüfen das Angebot und trennen konkrete Angaben von Werbesprache.'],
        ['Bericht bauen', 'Preis, Kosten, Lage und Gebäudedaten landen in einer ruhigen, klaren Ansicht.'],
        ['Fragen vorbereiten', 'Aus fehlenden Angaben werden sinnvolle Fragen an Verkäufer, Makler oder WEG.'],
      ],
      faqLabel: 'HÄUFIGE FRAGEN',
      faqTitle: 'Entspannter durch die Immobiliensuche.',
      faqIntro: 'Kurze Antworten für unklare Angebote, den Zahlencheck und die Frage, welche Immobilie wirklich einen zweiten Blick verdient.',
      faqs: [
        ['Wie bekomme ich aus einem schwammigen Immobilienangebot die wichtigen Fakten heraus?', 'Review a House macht aus dem Angebot einen klaren Bericht: Preis, Preis pro Quadratmeter, Größe, Zimmer, Etage, Baujahr, Energie, Heizung, Zustand, Licht, laufende Kosten und Lage. Werbesätze fliegen raus. Fehlende oder unklare Angaben bleiben sichtbar, statt einfach ergänzt zu werden.'],
        ['Kann ich Angebote von verschiedenen Immobilienportalen prüfen?', 'Ja. Füge einen öffentlichen Link ein oder lade ein durchsuchbares Exposé als PDF hoch. So sehen Angebote aus ganz unterschiedlichen Portalen immer gleich aus. Falls ein Portal den automatischen Zugriff blockiert, klappt es meist am zuverlässigsten mit dem PDF.'],
        ['Wie behalte ich bei einer längeren Immobiliensuche den Überblick?', 'Jeder geöffnete Bericht wird in deinem Browser chronologisch in der Seitenleiste gespeichert. Gute Kandidaten kannst du oben anpinnen, aussortierte wieder entfernen. Dasselbe Angebot wird nicht doppelt angelegt, damit die Liste sauber bleibt.'],
        ['Kann ich zwei Immobilien direkt vergleichen?', 'Ja. Wähle in der Seitenleiste zwei gespeicherte Berichte aus. Die Vergleichsansicht stellt Kaufpreis, Nebenkosten, Quadratmeterpreis, Größe, Etage, Energie, den Review-a-House-Score und weitere wichtige Angaben direkt nebeneinander.'],
        ['Kann ich einen Bericht oder Vergleich mit anderen teilen?', 'Ja. Jeder Bericht und jeder Vergleich hat einen festen Link. Schick ihn an Partner, Freunde, Familie oder deine Beratung – dann sprechen alle über dieselben Fakten und Annahmen.'],
        ['Wie sehe ich schnell, ob sich ein genauerer Blick lohnt?', 'Der Review-a-House-Score bewertet jede Immobilie nach derselben Formel auf einer Skala von 1 bis 10. Preis, Lage, Platz, Gebäude, Energie, Tageslicht, Kosten und Qualität der Quelle fließen ein. Du siehst auch die Einzelwerte. Der Score ist ein Filter, kein Verkehrswertgutachten und kein Ersatz für technische oder rechtliche Prüfung.'],
        ['Kann ich die grobe Finanzierung an meine Situation anpassen?', 'Ja. Eigenkapital, Zinssatz und anfängliche Tilgung lassen sich direkt im Bericht ändern. Darlehen und Monatsrate passen sich sofort an. Die Rechnung ist bewusst grob – finale Kosten und Konditionen solltest du mit einer Bank oder Beratung prüfen.'],
        ['Ist Review a House kostenlos und was bringen die Bezahlpakete?', 'Zwei Berichte pro Tag sind kostenlos. Pro kostet 10 € im Monat und erlaubt 10 Berichte pro Tag. Ultra kostet 20 € im Monat und erlaubt bis zu 100 Berichte pro Tag. Die Bezahlpakete erhöhen einfach dein tägliches Limit.'],
      ],
    },
    sidebar: {
      expand: 'Seitenleiste öffnen', collapse: 'Seitenleiste schließen', newAssessment: 'Neuer Bericht', upgrade: 'Upgrade', quota: '2 kostenlose Berichte pro Tag',
      yours: 'DEINE BERICHTE', empty: 'Deine gespeicherten Berichte erscheinen hier.', select: 'Auswählen', pin: 'Anpinnen', unpin: 'Loslösen',
      remove: 'Aus Seitenleiste entfernen', removeAssessment: 'Bericht aus Seitenleiste entfernen', compare: 'Auswahl vergleichen',
    },
    report: {
      brief: 'REVIEW A HOUSE / IMMOBILIEN-BERICHT', copyLink: 'Link kopieren', copied: 'Link kopiert', score: 'UNSER SCORE',
      deterministic: 'Einheitlich aus den Angaben im Angebot', scoreDetails: 'Score-Details ansehen', scoreExplainer: 'Der Score verbindet die folgenden Immobilienmerkmale bei jedem Bericht nach denselben Regeln.', asking: 'Kaufpreis', perSqm: 'Preis pro m²', living: 'Wohnfläche', usable: 'Nutzfläche', rooms: 'Zimmer', floor: 'Etage', use: 'Aktuelle Nutzung', monthly: '/ Monat', return: 'Angegebene Rendite', sun: 'Sonne / Ausrichtung', daylight: 'Tageslicht', energy: 'Energie', heating: 'Heizung', built: 'Baujahr',
      atGlance: 'AUF EINEN BLICK', details: 'ANGABEN IM EXPOSÉ', matters: 'WAS WICHTIG IST', notes: 'HINWEISE ZU DEN DATEN', notDisclosed: 'Nicht angegeben',
      components: { price: 'Preis', neighborhood: 'Lage', space: 'Platz', building: 'Gebäude', energy: 'Energie', light: 'Licht', costs: 'Kosten', source: 'Quelle' },
      source: 'QUELLE', original: 'Originalangebot öffnen ↗', saved: 'Bericht gespeichert', assessMore: 'MEHR BERICHTE ERSTELLEN', plansTitle: 'Bleib bei deiner Suche im Fluss.', plansCopy: 'Zwei Berichte pro Tag sind kostenlos. Wenn du gerade aktiv suchst, kannst du dein Limit erhöhen.', perMonth: '/Monat', proLimit: '10 Berichte pro Tag', ultraLimit: '100 Berichte pro Tag', proButton: 'Pro wählen', ultraButton: 'Ultra wählen',
    },
    finance: {
      label: 'GROBE FINANZIERUNG', knownOutlay: 'Bekannte Monatskosten vor Mieteinnahmen', payment: 'Grobe monatliche Kreditrate', loan: 'Darlehen', purchase: 'Kaufpreis', buyerCosts: 'Kaufnebenkosten', total: 'Gesamtkosten', equity: 'Eigenkapital', rate: 'Sollzins', repayment: 'Anfängliche Tilgung', note: 'Grobe Annuitätenrechnung, kein Finanzierungsangebot. Das Hausgeld ist brutto angegeben; bei vermieteten Wohnungen den umlagefähigen und den eigenen Anteil prüfen. Zinssatz, Kaufnebenkosten und Leistbarkeit bitte mit einer Bank klären.',
    },
    questions: { label: 'VOR DEM ANGEBOT FRAGEN', reviewing: 'Angebot wird geprüft', tailored: 'Auf dieses Angebot zugeschnitten', core: 'Wichtige Grundfragen', title: 'Diese Antworten solltest du schriftlich haben', note: 'Unterlagen und klare Antworten zählen mehr als mündliche Zusagen.' },
    map: { label: 'LAGE', intro: 'Prüfe auf der Karte echte Wege zu U-Bahn, S-Bahn, Tram, Parks und Dingen des täglichen Lebens – nicht nur die Luftlinie.', loading: 'Lage wird gesucht…', explore: 'Auf OpenStreetMap öffnen ↗', approximate: 'Im Angebot steht keine genaue Adresse. Die Karte zeigt den genauesten genannten Bereich:', exact: 'Im Angebot steht eine genaue Straßenadresse.' },
    compare: { label: 'IMMOBILIENVERGLEICH', title: 'Zwei Immobilien, direkt nebeneinander.', intro: 'Eine ruhige Ansicht der Fakten, die eine Entscheidung verändern.', property: 'IMMOBILIE', option: 'OPTION', asking: 'Kaufpreis', acquisition: 'Gesamte Kaufkosten', perSqm: 'Preis pro Wohn-m²', living: 'Wohnfläche', usable: 'Nutzfläche', rooms: 'Zimmer', floor: 'Etage', use: 'Aktuelle Nutzung', housegeld: 'Hausgeld', monthly: '/ Monat', return: 'Angegebene Rendite', energy: 'Energie', score: 'Unser Score' },
    ads: { partner: 'PLATZ FÜR PARTNER', note: 'Ein ruhiger Platz für einen hilfreichen Partner – ohne Ablenkung.', finance: 'Finanzierung, Gutachten oder Kaufberatung', local: 'Makler, Architekt oder Partner fürs Zuhause' },
  },
} as const;

export function localizedValue(value: string | undefined, locale: Locale) {
  if (!value || /not stated|unknown|address not stated/i.test(value)) return copy[locale].report.notDisclosed;
  if (locale === 'en') return value;
  const translations: Record<string, string> = {
    Rented: 'Vermietet', Vacant: 'Frei', 'Owner-occupied': 'Selbst genutzt',
    'Floor-to-ceiling windows; abundant daylight claimed': 'Bodentiefe Fenster; viel Tageslicht laut Angebot',
  };
  return translations[value] || value;
}
