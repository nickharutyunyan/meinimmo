import assert from 'node:assert/strict';
import test from 'node:test';
import { checkedCharacteristic, looksLikePropertyListing, parseListing } from '../lib/listing-parser.ts';
import { localizedFeatures } from '../lib/i18n.ts';

const tableRow = (label, value) => `<tr><td><div>${label}</div></td><td><div>${value}</div></td></tr>`;

test('keeps publisher metadata out of the property location and separates living from usable area', () => {
  const html = `
    <html><head>
      <title>2,5-Zimmer-Wohnung mit Terrasse in Berlin-Mitte – 5,12% Rendite</title>
    </head><body><main>
      <h1>2,5-Zimmer-Wohnung mit Terrasse in Berlin-Mitte – 5,12% Rendite</h1>
      <div>10179 Berlin <span>(Mitte)</span></div>
      <div>539.000 €</div><div>2,5 Zimmer</div><div>60 m²</div><div>Wohnfläche</div>
      <p>In einem 2017 errichteten Neubau liegt dieses komplett möblierte Apartment mit 60 m² Wohnfläche (66 m² Nutzfläche inklusive Terrasse). Die Wohnung ist vermietet. Bodentiefe Fenster lassen viel Tageslicht herein.</p>
      <table>
        ${tableRow('Aktuelle Nutzung', 'Vermietet')}
        ${tableRow('Kaufpreis', '539.000 €')}
        ${tableRow('Kaufnebenkosten ca.', '39.315 €')}
        ${tableRow('Gesamtkosten ca.', '578.314 €')}
        ${tableRow('Hausgeld mtl.', '515 €')}
        ${tableRow('Maklerprovision', '0 €')}
        ${tableRow('Nutzfläche', '66 m²')}
        ${tableRow('Heizung', 'Fußbodenheizung')}
        ${tableRow('Baujahr', '2017')}
        ${tableRow('Ausstattung', 'Terrasse, Garten, Keller, Barrierefrei')}
        ${tableRow('Energieeffizienzklasse', 'A')}
        ${tableRow('Energieausweistyp', 'Bedarfsausweis')}
        ${tableRow('Wesentlicher Energieträger', 'Fernwärme')}
        ${tableRow('Endenergiebedarf', '31,90 kWh/(m²a)')}
      </table>
    </main><footer>Company footer</footer>
    <script type="application/ld+json">{"@type":"Organization","address":{"streetAddress":"Herrengraben 6","postalCode":"21465","addressLocality":"Reinbek"}}</script>
    </body></html>`;

  const report = parseListing(html, 'https://example.test/listing');
  assert.equal(report.title, '2.5-room flat · Mitte');
  assert.equal(report.location, 'Mitte');
  assert.equal(report.address, 'Address not stated');
  assert.equal(report.facts.city, 'Berlin');
  assert.equal(report.facts.area, 60);
  assert.equal(report.facts.usableArea, 66);
  assert.equal(report.facts.totalCost, 578314);
  assert.equal(report.facts.housegeld, 515);
  assert.equal(report.facts.buyerCommission, 'Commission-free');
  assert.equal(report.facts.tenancy, 'Rented');
  assert.equal(report.facts.energySource, 'Fernwärme');
  assert.match(report.daylight || '', /daylight/i);
  assert.ok(!JSON.stringify(report).includes('Reinbek'));
});

test('accepts and accurately parses an English-language Berlin Exposé PDF', () => {
  const pdfText = `
    A&S Property Berlin Brandenburg GmbH
    A modern duplex apartment with a balcony and a share of the garden
    Graunstr. 6
    13355 Berlin
    A&S Property Berlin Brandenburg GmbH
    Uthmannstr. 13, 12043 Berlin
    Ansprechpartnerin: Tetyana Stammo
    OBJEKTDATEN
    Type of property Apartment
    Kind of property Duplex apartment
    Type of commercialization Purchase
    Neubau/Altbau New construction
    Living area approx. 73 sqm
    Room 2
    Heating type Central heating system, Underfloor heating
    Elevator Lift
    Year of construction 2025
    Condition First occupancy
    Energy certificate Requirement-oriented certificate
    Final energy demand 26,6 kWh/(m2a)
    Main energy source Gas
    Energy efficiency class A+
    Purchase price 499.000,00 e
    External commission 3.00 % plus VAT of the notarized purchase
    price
    Community fees 333,00 e
    Property description
    The upper level features a sleeping area with a sunny balcony.
    LOCATION
    The property is located in the northern part of Berlin-Mitte, right next to Mauerpark.
  `;

  assert.equal(looksLikePropertyListing(pdfText), true);
  const report = parseListing(pdfText, 'Expose Maisonette Berlin.pdf');
  assert.equal(report.title, '2-room flat · Graunstr. 6');
  assert.equal(report.address, 'Graunstr. 6, 13355 Berlin');
  assert.equal(report.facts.street, 'Graunstr. 6');
  assert.equal(report.facts.district, 'Mitte');
  assert.equal(report.facts.price, 499000);
  assert.equal(report.facts.area, 73);
  assert.equal(report.facts.rooms, '2');
  assert.equal(report.facts.year, '2025');
  assert.equal(report.facts.energy, 'A+');
  assert.equal(report.facts.energyDemand, 26.6);
  assert.equal(report.facts.housegeld, 333);
  assert.equal(report.facts.condition, 'New build');
  assert.equal(report.facts.buyerCommission, '3.00 % plus VAT of the notarized purchase price');
  assert.equal(report.sunOrientation, 'Sunny balcony stated');
  assert.match(report.considerations.join(' '), /shared running costs and owner-only costs/i);
  assert.doesNotMatch(report.considerations.join(' '), /reserve is adequate/i);
  assert.doesNotMatch(JSON.stringify(report), /Uthmannstr/);
});

test('never turns a decorative heading after Ausstattung into a listing feature', () => {
  const pdfText = `
    Bezugsfreie 3-Zimmer-Altbauwohnung zwischen Arkonaplatz und Mauerpark
    Mitte (Ortsteil), 10435 Berlin
    Kaufpreis: 399.000 €
    Wohnfläche ca.: 61 m²
    Zimmer: 3
    Etage: 1 von 5
    Baujahr: 1900
    Objektzustand: Saniert
    Online-Besichtigung Einbauküche Keller
    Ausstattung
    ★ Wichtiges auf einen Blick ★
    *Vermietet: nein
    *Größe der WEG: 11 Einheiten
    *Hausgeld im Monat ca.: 443€ (ab Jan. 2027)
    *Denkmalschutz: nein
    Energieeffizienzklasse: B
  `;

  const report = parseListing(pdfText, 'Arkonaplatz Exposé');
  assert.deepEqual(report.facts.features, ['Einbauküche', 'Keller']);
  assert.equal(report.facts.tenancy, 'Not rented');
  assert.doesNotMatch(JSON.stringify(report.facts.features), /Wichtiges auf einen Blick/i);

  // Existing saved reports are cleaned at render time too.
  assert.deepEqual(
    localizedFeatures(['★ Wichtiges auf einen Blick ★', 'Einbauküche', 'Keller'], 'en'),
    ['Fitted kitchen', 'Basement / cellar'],
  );
});

test('keeps field-label fragments and unrelated words out of characteristics', () => {
  const pdfText = `
    Perfekt für Paare – mit Platz fürs Homeoffice
    Ella-Kay-Straße, 10405 Berlin
    Kaufpreis: 494.000 €
    Wohnfläche: 67,23 m²
    Zimmer: 2,5
    Baujahr: 2027
    Heizungsart: Wärmepumpe
    Energieträger: Umweltwärme
    Energieausweistyp: Bedarfsausweis
    Objektzustand: Erstbezug
  `;

  const report = parseListing(pdfText, 'Property Exposé');
  assert.equal(report.facts.heating, 'Wärmepumpe');
  assert.equal(report.facts.energySource, 'Umweltwärme');
  assert.equal(report.facts.energyCertificate, 'Bedarfsausweis');
  assert.equal(report.facts.condition, 'Erstbezug');
  assert.doesNotMatch(JSON.stringify(report.facts), /sart:/i);

  // Previously saved malformed values are safely repaired at read time.
  assert.equal(checkedCharacteristic('sart: Wärmepumpe', 'heating'), 'Wärmepumpe');
  assert.equal(checkedCharacteristic('Jetzt Plus aktivieren', 'heating'), '');
  assert.equal(checkedCharacteristic('https://example.test', 'energySource'), '');
});

test('English text still needs several independent property signals', () => {
  assert.equal(looksLikePropertyListing('Purchase planning document for an apartment team. Room 2 contains general meeting notes and a Berlin office postcode 10115.'), false);
});

test('extracts buyer commission only from explicit listing evidence', () => {
  const percentage = parseListing(`
    <title>3-Zimmer-Wohnung in Leipzig</title><main>
    <p>04109 Leipzig</p><div>Kaufpreis</div><div>350.000 €</div>
    <div>Wohnfläche</div><div>80 m²</div>
    <div>Käuferprovision</div><div>3,57 % inkl. MwSt.</div>
    </main>`, 'https://example.test/commission');
  assert.equal(percentage.facts.buyerCommission, '3,57 % inkl. MwSt.');

  const explicitlyFree = parseListing(`
    <title>Provisionsfreie 2-Zimmer-Wohnung in Dresden</title><main>
    <p>01067 Dresden</p><div>Kaufpreis</div><div>280.000 €</div>
    <div>Wohnfläche</div><div>58 m²</div>
    </main>`, 'https://example.test/free');
  assert.equal(explicitlyFree.facts.buyerCommission, 'Commission-free');

  const absent = parseListing(`
    <title>Vermietete Wohnung mit 3,57 % Rendite in Erfurt</title><main>
    <p>99084 Erfurt</p><div>Kaufpreis</div><div>240.000 €</div>
    <div>Wohnfläche</div><div>60 m²</div><p>Die angegebene Rendite beträgt 3,57 %.</p>
    </main>`, 'https://example.test/no-commission');
  assert.equal(absent.facts.buyerCommission, undefined);
});

test('uses living area in a title when room count is absent', () => {
  const html = `
    <title>Helle Eigentumswohnung in Hamburg-Eimsbüttel</title>
    <main><h1>Helle Eigentumswohnung</h1><p>20257 Hamburg (Eimsbüttel)</p>
    <div>Wohnfläche</div><div>74 m²</div><div>Kaufpreis</div><div>625.000 €</div>
    <div>Baujahr</div><div>1998</div><div>Energieeffizienzklasse</div><div>C</div>
    <div>Heizung</div><div>Zentralheizung</div></main>`;

  const report = parseListing(html, 'PDF Exposé');
  assert.equal(report.facts.rooms, 'not stated');
  assert.equal(report.title, '74 m² flat · Eimsbüttel');
  assert.doesNotMatch(report.title, /not stated-room/i);
});

test('keeps the title simple when size is absent and accepts property-scoped JSON-LD only', () => {
  const html = `
    <title>Haus zum Kauf</title><main><h1>Haus zum Kauf</h1>
    <div>Kaufpreis</div><div>750.000 €</div><div>Baujahr</div><div>2019</div>
    <div>Energieeffizienzklasse</div><div>B</div><div>Heizung</div><div>Wärmepumpe</div></main>
    <script type="application/ld+json">{
      "@context":"https://schema.org","@type":"House",
      "address":{"@type":"PostalAddress","streetAddress":"Testweg 12","postalCode":"14467","addressLocality":"Potsdam"}
    }</script>`;

  const report = parseListing(html, 'https://example.test/house');
  assert.equal(report.title, 'House · Testweg 12');
  assert.equal(report.address, 'Testweg 12, 14467 Potsdam');
});

test('uses explicit occupancy and condition evidence without inferring from generic rental language', () => {
  const available = parseListing(`
    <title>3-Zimmer-Wohnung in Köln-Ehrenfeld</title><main>
    <p>50823 Köln (Ehrenfeld)</p><div>Kaufpreis</div><div>420.000 €</div>
    <div>Wohnfläche</div><div>78 m²</div><div>Aktuelle Nutzung</div><div>Bezugsfrei</div>
    <div>Zustand</div><div>Renovierungsbedürftig</div><div>Baujahr</div><div>1962</div>
    <div>Energieeffizienzklasse</div><div>F</div><div>Heizung</div><div>Gas</div>
    </main>`, 'https://example.test/available');
  assert.equal(available.facts.tenancy, 'Not rented');
  assert.equal(available.facts.condition, 'Needs renovation');

  const ownerOccupied = parseListing(`
    <title>Wohnung zum Kauf in Bonn</title><main><p>53113 Bonn</p>
    <div>Kaufpreis</div><div>520.000 €</div><div>Wohnfläche</div><div>72 m²</div>
    <div>Aktuelle Nutzung</div><div>Eigengenutzt</div><div>Baujahr</div><div>2001</div>
    <div>Energieeffizienzklasse</div><div>C</div></main>`, 'https://example.test/owner-occupied');
  assert.equal(ownerOccupied.facts.tenancy, 'Not rented');

  const unknown = parseListing(`
    <title>2-Zimmer-Wohnung in Leipzig-Südvorstadt</title><main>
    <p>Ideal zur Vermietung oder Eigennutzung. Ein vermieteter Stellplatz kann separat erworben werden.</p>
    <p>04275 Leipzig (Südvorstadt)</p><div>Kaufpreis</div><div>310.000 €</div>
    <div>Wohnfläche</div><div>55 m²</div><div>Baujahr</div><div>1995</div>
    <div>Energieeffizienzklasse</div><div>C</div><div>Heizung</div><div>Fernwärme</div>
    </main>`, 'https://example.test/unknown');
  assert.equal(unknown.facts.tenancy, undefined);
  assert.equal(unknown.facts.buyerCosts, undefined);
  assert.equal(unknown.facts.totalCost, 0);
  assert.doesNotMatch(unknown.summary, /sold rented|not rented|available to move|owner-occupied/i);
});

test('preserves an explicit future availability date instead of flattening it to not rented', () => {
  const report = parseListing(`
    Südbalkon-Traum im 1. Obergeschoss
    Sandhauser Straße 3, Konradshöhe, 13505 Berlin
    Kaufpreis: 497.000 €
    Wohnfläche ca.: 87 m²
    Bezugsfrei ab: 27.8.2026
    Zimmer: 3
    Etage: 1 von 1
    Objektzustand: Neuwertig
  `, 'Südbalkon-Traum.pdf');

  assert.equal(report.facts.tenancy, 'Not rented');
  assert.equal(report.facts.availabilityDate, '2026-08-27');
  assert.match(report.summary, /available from 27 August 2026/i);
  assert.doesNotMatch(report.summary, /states that it is not rented/i);
});

test('normalizes a numeric labeled floor without pulling unrelated text', () => {
  const report = parseListing(`
    <title>2-Zimmer-Wohnung in München-Sendling</title><main>
    <p>81371 München (Sendling)</p><div>Kaufpreis</div><div>510.000 €</div>
    <div>Wohnfläche</div><div>61 m²</div><div>Etage</div><div>2</div>
    <div>Baujahr</div><div>2012</div><div>Energieeffizienzklasse</div><div>A+</div>
    <div>Heizung</div><div>Fernwärme</div></main>`, 'https://example.test/floor');
  assert.equal(report.facts.floor, '2. OG');
  assert.equal(report.facts.energy, 'A+');
});

test('treats first occupancy after renovation as renovated, not a new build', () => {
  const report = parseListing(`
    <title>Sanierter Altbau in Berlin</title><main><p>13359 Berlin</p>
    <div>Kaufpreis</div><div>409.000 €</div><div>Wohnfläche</div><div>68 m²</div>
    <div>2</div><div>Zimmer</div><div>Zustand</div><div>Erstbezug nach Sanierung</div>
    <div>Baujahr</div><div>1913</div><div>Energieeffizienzklasse</div><div>E</div>
    <div>Heizung</div><div>Zentralheizung</div></main>`, 'https://example.test/renovated');
  assert.equal(report.facts.rooms, '2');
  assert.equal(report.facts.condition, 'Renovated');
});

test('extracts compact inline facts before background verification finishes', () => {
  const report = parseListing(`
    IMMOBILIENEXPOSÉ Eigentumswohnung zum Kauf.
    Adresse: Danziger Straße 18, 10435 Berlin. Bezirk: Prenzlauer Berg.
    Kaufpreis: 450.000 EUR. Wohnfläche: 65 m². Zimmer: 2 Zimmer.
    Etage: 2. OG. Baujahr: 1900. Energieeffizienzklasse: D.
    Zustand: renoviert. Bezugsfrei ab sofort. Hausgeld: 280 EUR monatlich.
    Öffentlicher Nahverkehr: Tram M10 und U-Bahnhof Eberswalder Straße.
    Diese Angaben beschreiben die angebotene Immobilie.
  `, 'PDF Exposé');

  assert.equal(report.facts.price, 450000);
  assert.equal(report.facts.area, 65);
  assert.equal(report.facts.year, '1900');
  assert.equal(report.facts.energy, 'D');
  assert.equal(report.facts.housegeld, 280);
  assert.equal(report.facts.transitStop, 'Eberswalder Straße');
});

test('parses an ImmoScout PDF export without confusing price per m² or the agency address', () => {
  const report = parseListing(`
    Großzügige 3-Raum-Altbauwohnung mit Balkon im Prenzlauer Berg
    Prenzlauer Berg, 10439 Berlin
    575.000 €
    Kaufpreis 6.272 €/m²
    91,68 m²
    Wohnfläche ca.
    Typ: Hochparterre
    Etage: 1
    Wohnfläche ca.: 91,68 m²
    Bezugsfrei ab: sofort
    Zimmer: 3
    Kaufpreis: 575.000 €
    Preis/m²: 6.272 €/m²
    Hausgeld: 445 €
    Provision für Käufer: Nein
    46.000 €
    Nebenkosten
    621.000 €
    Gesamtkosten
    Baujahr: 1914
    Objektzustand: Saniert
    Heizungsart: Gas-Heizung
    Energieträger: Gas
    Energieausweistyp: Verbrauchsausweis
    Endenergieverbrauch: 146,2 kWh/(m²*a)
    Diese Immobilie befindet sich im Prenzlauer Berg direkt im Humann Kiez.
    Der Humannplatz mit Grün- und Spielflächen ist in 5 Gehminuten erreichbar.
    Einkaufsmöglichkeiten, Apotheken und die Carl-Humann-Grundschule liegen im direkten Umfeld.
    Marcus Engel Immobilien
    Gewerblich · Friedrich-Ebert-Str. 2, 16225 Eberswalde
    Impressum
  `, 'Prenzlauer Berg Exposé');

  assert.equal(report.facts.price, 575000);
  assert.equal(report.facts.area, 91.68);
  assert.equal(report.facts.floor, 'Hochparterre');
  assert.equal(report.facts.housegeld, 445);
  assert.equal(report.facts.totalCost, 621000);
  assert.equal(report.facts.tenancy, 'Not rented');
  assert.equal(report.facts.condition, 'Renovated');
  assert.equal(report.facts.district, 'Humannkiez');
  assert.equal(report.title, '3-room flat · Humannkiez');
  assert.equal(report.address, 'Address not stated');
  assert.doesNotMatch(JSON.stringify(report), /Friedrich-Ebert|Eberswalde/);
});

test('parses a PDF financing block without treating its monthly quote as the total cost', () => {
  const report = parseListing(`
    Eigentumswohnung, bezugsfrei
    Möckernstraße -, Kreuzberg, 10963 Berlin
    480.000 €
    Kaufpreis 5.581 €/m²
    3
    Zi.
    86 m²
    Wohnfläche ca.
    Typ: Etagenwohnung
    Etage: 3 von 5
    Wohnfläche ca.: 86 m²
    Nutzfläche ca.: 90 m²
    Bezugsfrei ab: sofort
    Zimmer: 3
    Ab 1.531 € mtl. finanzieren
    Kaufpreis: 480.000 €
    Preis/m²: 5.581 €/m²
    Hausgeld: 145 €
    Provision für Käufer: Nein
    480.000 €
    Kaufpreis
    38.400 €
    Nebenkosten
    Basierend auf Marktdaten: 3,35 % Sollzins, 1% Tilgung, 96.000 Eigenkapital
    Baujahr: 1885
    Objektzustand: Gepflegt
    Heizungsart: Etagenheizung
    Energieträger: Gas
    Energieausweistyp: Verbrauchsausweis
    Endenergieverbrauch: 154,1 kWh/(m²*a)
    Energieeffizienzklasse:
    518.400 €
    Gesamtkosten
    Ab 1.531 € mtl. finanzieren
    Lage
    Möckernstraße -, Kreuzberg, 10963 Berlin
  `, 'Eigentumswohnung, bezugsfrei');

  assert.equal(report.facts.price, 480_000);
  assert.equal(report.facts.buyerCosts, 38_400);
  assert.equal(report.facts.totalCost, 518_400);
  assert.equal(report.facts.area, 86);
  assert.equal(report.facts.usableArea, 90);
  assert.equal(report.facts.floor, '3. OG');
  assert.equal(report.facts.tenancy, 'Not rented');
  assert.equal(report.facts.condition, 'Well maintained');
  assert.equal(report.facts.energyDemand, 154.1);
  assert.equal(report.facts.energy, 'E');
  assert.equal(report.facts.district, 'Kreuzberg');
  assert.equal(report.facts.street, 'Möckernstraße');
  assert.equal(report.facts.locationPrecision, 'street');
  assert.equal(report.title, '3-room flat · Möckernstraße');
  assert.equal(report.address, 'Address not stated');
});

test('uses a named property street directly when no house number is disclosed', () => {
  const report = parseListing(`
    2-Zimmer-Wohnung zum Kauf
    10439 Berlin, Prenzlauer Berg
    Kaufpreis: 420.000 €
    Wohnfläche: 64 m²
    Lage: Die Wohnung liegt nahe der Danziger Straße.
    Baujahr: 1910
  `, 'Street Exposé');

  assert.equal(report.facts.street, 'Danziger Straße');
  assert.equal(report.facts.locationPrecision, 'street');
  assert.equal(report.title, '2-room flat · Danziger Straße');
  assert.equal(report.address, 'Address not stated');
});
