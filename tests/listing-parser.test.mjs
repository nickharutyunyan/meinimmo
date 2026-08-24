import assert from 'node:assert/strict';
import test from 'node:test';
import { parseListing } from '../lib/listing-parser.ts';

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
  assert.equal(report.facts.tenancy, 'Rented');
  assert.equal(report.facts.energySource, 'Fernwärme');
  assert.match(report.daylight || '', /daylight/i);
  assert.ok(!JSON.stringify(report).includes('Reinbek'));
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

test('uses year as the next safe title fallback and accepts property-scoped JSON-LD only', () => {
  const html = `
    <title>Haus zum Kauf</title><main><h1>Haus zum Kauf</h1>
    <div>Kaufpreis</div><div>750.000 €</div><div>Baujahr</div><div>2019</div>
    <div>Energieeffizienzklasse</div><div>B</div><div>Heizung</div><div>Wärmepumpe</div></main>
    <script type="application/ld+json">{
      "@context":"https://schema.org","@type":"House",
      "address":{"@type":"PostalAddress","streetAddress":"Testweg 12","postalCode":"14467","addressLocality":"Potsdam"}
    }</script>`;

  const report = parseListing(html, 'https://example.test/house');
  assert.equal(report.title, '2019-built house · Potsdam');
  assert.equal(report.address, 'Testweg 12, 14467 Potsdam');
});
