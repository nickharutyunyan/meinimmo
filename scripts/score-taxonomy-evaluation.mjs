// Frozen expectations from the independent PDF review, not model self-grading.
// Usage: node scripts/score-taxonomy-evaluation.mjs tmp/jev-eval/taxonomy-....json
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const expected = {
  'Perfekt für Paare – mit Platz fürs Homeoffice.pdf': { floor: 'upper', buildingState: 'first_occupancy', availability: 'dated', heating: 'heat_pump', energy: 'a_plus' },
  'Eigentumswohnung, bezugsfrei.pdf': { floor: 'upper', buildingState: 'maintained', occupancy: 'not_rented', availability: 'immediate', heating: 'individual', energy: 'e' },
  'Expose_Maisonette_Berlin (1).pdf': { buildingState: 'first_occupancy', heating: 'mixed', energy: 'a_plus' },
};
let displayed = 0, correct = 0, sourceKnown = 0, missed = 0, graphicMissing = 0;
const errors = [];
const times = [];
for (const row of rows) {
  const name = row.filename.normalize('NFC');
  if (!expected[name]) throw new Error(`No independently reviewed expectations for ${name}`);
  times.push(row.ms);
  for (const [field, result] of Object.entries(row.taxonomy.fields)) {
    const truth = expected[name][field] || 'unknown';
    if (truth !== 'unknown') sourceKnown++;
    if (result.value === 'unknown') {
      if (truth !== 'unknown') {
        missed++;
        if (field === 'energy' && !name.startsWith('Expose_')) graphicMissing++;
      }
    } else {
      displayed++;
      if (result.value === truth) correct++;
      else errors.push({ filename: name, field, actual: result.value, expected: truth });
    }
  }
}
times.sort((a,b) => a-b);
console.log(JSON.stringify({ sampleDocuments: rows.length, displayed, correct, errors, abstainedKnown: missed,
  visualOnlyMissing: graphicMissing, knownFromPDF: sourceKnown, knownFromText: sourceKnown - graphicMissing,
  displayedPrecision: displayed ? correct / displayed : null,
  pdfCoverage: sourceKnown ? correct / sourceKnown : null,
  textCoverage: sourceKnown > graphicMissing ? correct / (sourceKnown - graphicMissing) : null,
  timingMs: times, warning: 'Small development sample, not proof of 99% accuracy or end-to-end speed.' }, null, 2));
if (errors.length) process.exitCode = 1;
