import assert from 'node:assert/strict';
import test from 'node:test';
import { parseListing } from '../lib/listing-parser.ts';
import { calculatePropertyScore } from '../lib/property-score.ts';

const row = (label, value) => `<div>${label}</div><div>${value}</div>`;

test('property score is deterministic, bounded and driven by property characteristics', () => {
  const strong = parseListing(`
    <title>3-Zimmer-Wohnung in Berlin-Kreuzberg</title><main>
    <p>10997 Berlin (Kreuzberg)</p>
    ${row('Kaufpreis', '390.000 €')}${row('Wohnfläche', '82 m²')}${row('Etage', '3. OG')}
    ${row('Baujahr', '2018')}${row('Zustand', 'Kernsaniert')}${row('Energieeffizienzklasse', 'A')}
    ${row('Heizung', 'Wärmepumpe')}${row('Hausgeld mtl.', '280 €')}${row('Ausrichtung', 'Südwest')}
    ${row('Ausstattung', 'Balkon, Keller, Aufzug')}
    <p>Die U-Bahn ist 4 Gehminuten entfernt, der Park 5 Minuten und der Supermarkt 3 Minuten.</p>
    </main>`, 'https://example.test/strong');
  const weak = parseListing(`
    <title>3-Zimmer-Wohnung in Berlin-Kreuzberg</title><main>
    <p>10997 Berlin (Kreuzberg)</p>
    ${row('Kaufpreis', '920.000 €')}${row('Wohnfläche', '48 m²')}${row('Etage', 'Souterrain')}
    ${row('Baujahr', '1965')}${row('Zustand', 'Sanierungsbedürftig')}${row('Energieeffizienzklasse', 'H')}
    ${row('Heizung', 'Ölheizung')}${row('Hausgeld mtl.', '520 €')}${row('Ausrichtung', 'Nord')}
    <p>Die U-Bahn ist 25 Minuten entfernt.</p>
    </main>`, 'https://example.test/weak');

  const strongScore = calculatePropertyScore(strong);
  const repeated = calculatePropertyScore(strong);
  const weakScore = calculatePropertyScore(weak);

  assert.deepEqual(strongScore, repeated);
  assert.ok(strongScore.total <= 10 && strongScore.total >= 0);
  assert.ok(weakScore.total <= 10 && weakScore.total >= 0);
  assert.ok(strongScore.total > weakScore.total + 2);
  assert.equal(strong.facts.neighborhood?.transitMinutes, 4);
  assert.equal(strong.facts.neighborhood?.dailyNeedsMinutes, 3);
  assert.equal(strong.score, strongScore.total);
});

test('source completeness is only five percent of the total score', () => {
  const complete = parseListing(`
    <title>2-Zimmer-Wohnung in Leipzig-Zentrum</title><main><p>04109 Leipzig (Zentrum)</p>
    ${row('Kaufpreis', '240.000 €')}${row('Wohnfläche', '58 m²')}${row('Etage', '2. OG')}
    ${row('Baujahr', '2008')}${row('Energieeffizienzklasse', 'B')}${row('Heizung', 'Fernwärme')}
    </main>`, 'PDF Exposé');
  const score = calculatePropertyScore(complete);
  assert.ok(score.breakdown.source >= 8);
  assert.ok(score.total < score.breakdown.source);
});

test('new construction with a heat pump scores strongly without inventing an energy class', () => {
  const report = parseListing(`
    <title>2,5-Zimmer-Neubauwohnung in Berlin</title><main>
    ${row('Kaufpreis', '494.000 €')}${row('Wohnfläche', '67,23 m²')}
    ${row('Baujahr', '2027')}${row('Objektzustand', 'Erstbezug')}
    ${row('Heizungsart', 'Wärmepumpe')}${row('Wesentliche Energieträger', 'Umweltwärme')}
    ${row('Energieausweistyp', 'Bedarfsausweis')}${row('Energieeffizienzklasse', '')}
    </main>`, 'PDF Exposé');

  const score = calculatePropertyScore(report);
  assert.equal(report.facts.energy, 'not stated');
  assert.equal(score.breakdown.energy, 9);
  assert.ok(score.breakdown.energy < 10, 'an unstated class must not be treated as verified A+');
});
