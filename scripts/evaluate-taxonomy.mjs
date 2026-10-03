import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfTextFromItems } from '../lib/pdf-text.ts';
import { parseListing } from '../lib/listing-parser.ts';
import { requestJev } from '../lib/jev-client.ts';
import { factualTaxonomyRequest, parseFactualTaxonomy, taxonomyInputHash } from '../lib/property-taxonomy.ts';

const input = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const key = (await input.question('Jev key (terminal echo must be disabled): ')).trim();
input.close();
if (!key) throw new Error('Missing key');
const results = [];
for (const filename of process.argv.slice(2)) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(filename)) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) pages.push(pdfTextFromItems((await (await pdf.getPage(i)).getTextContent()).items));
  const report = parseListing(pages.join('\n'), path.basename(filename));
  const hash = await taxonomyInputHash(report);
  const start = performance.now();
  const raw = await requestJev(factualTaxonomyRequest(report), key, 5000);
  const taxonomy = parseFactualTaxonomy(raw, report, hash);
  const result = { filename: path.basename(filename), ms: Math.round(performance.now() - start), facts: report.facts, title: report.title, taxonomy, rawAnswers: raw.answers };
  results.push(result);
  console.log(JSON.stringify({ filename: result.filename, ms: result.ms, title: result.title, categories: Object.fromEntries(Object.entries(taxonomy.fields).map(([k, v]) => [k, v.value])) }));
  await pdf.destroy();
}
fs.mkdirSync('tmp/jev-eval', { recursive: true });
const output = `tmp/jev-eval/taxonomy-${Date.now()}.json`;
fs.writeFileSync(output, JSON.stringify(results, null, 2));
console.log('Results:', output);
