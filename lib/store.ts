import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Comparison, Report } from './types';
import { canonicalCondition } from './property-condition.ts';
import { acquisitionCosts } from './finance.ts';
import { checkedCharacteristic, refreshDerivedReport } from './listing-parser.ts';

import { cleanReportAddress } from './location-validation.ts';
import { EXTRACTION_VERSION, presentStoredReport } from './report-integrity.ts';
import { BACKFILL_BATCH_SIZE } from './report-backfill.ts';
import { withTimeout } from './io-timeout.ts';
import { invalidateReportHtml } from './report-html-cache.ts';

type StoredRow = { data: string };

async function database() {
  const { env } = await withTimeout(getCloudflareContext({ async: true }));
  if (!env.DB) throw new Error('The Cloudflare D1 binding "DB" is not configured.');
  return env.DB;
}

function parse<T>(row: StoredRow | null) {
  return row ? JSON.parse(row.data) as T : undefined;
}

function normalizedReport(item: Report) {
  if (item.country === 'AM') return presentStoredReport(item);
  const clean = cleanReportAddress(item);
  if (clean !== item) item = refreshDerivedReport(clean);
  const condition = canonicalCondition(item.facts.condition);
  const costs = acquisitionCosts(item.facts);
  const totalCost = item.facts.totalCost && item.facts.totalCost < item.facts.price
    ? (item.facts.buyerCosts ? costs.total : 0)
    : item.facts.totalCost;
  const energy = item.facts.energy;
  const heating = checkedCharacteristic(item.facts.heating, 'heating') || 'not stated';
  const energySource = checkedCharacteristic(item.facts.energySource, 'energySource') || undefined;
  const energyCertificate = checkedCharacteristic(item.facts.energyCertificate, 'energyCertificate') || undefined;
  const summary = (condition === 'Renovated'
    ? item.summary.replace(/described as (?:saniert|renoviert|new condition|like new)/i, 'described as renovated')
    : item.summary).replace(/It is built in /g, 'Listing details: built in ');
  const hasUnsupportedReserveConclusion = item.considerations.some(value => /WEG reserve is adequate/i.test(value));
  const ready = condition === item.facts.condition && summary === item.summary && totalCost === item.facts.totalCost && energy === item.facts.energy
    && heating === item.facts.heating && energySource === item.facts.energySource && energyCertificate === item.facts.energyCertificate
    && !hasUnsupportedReserveConclusion
    ? item
    : refreshDerivedReport({ ...item, summary, facts: { ...item.facts, condition, totalCost, energy, heating, energySource, energyCertificate } });
  return presentStoredReport(ready);
}

export async function saveReportSource(id: string, source: string) {
  const db = await database();
  await withTimeout(db.prepare('INSERT INTO report_sources(report_id, source_text, saved_at) VALUES (?1, ?2, ?3) ON CONFLICT(report_id) DO UPDATE SET source_text = excluded.source_text, saved_at = excluded.saved_at').bind(id, source, new Date().toISOString()).run());
}

export async function reports() {
  const db = await database();
  const result = await withTimeout(db.prepare('SELECT data FROM reports ORDER BY created_at ASC').all<StoredRow>());
  return result.results.map(row => normalizedReport(JSON.parse(row.data) as Report));
}

export async function report(id: string) {
  const db = await database();
  const item = parse<Report>(await withTimeout(db.prepare('SELECT data FROM reports WHERE id = ?1').bind(id).first<StoredRow>()));
  // Pages, print, and metadata render this row only. Archived HTML is read by
  // the backfill route and by an explicit re-import, never here.
  return item ? normalizedReport(item) : undefined;
}

/** At most one batch of report JSON. Archived HTML is loaded one id at a time by the caller. */
export async function staleReportsForBackfill() {
  const db = await database();
  const result = await withTimeout(db.prepare(`
    SELECT data FROM reports
    WHERE COALESCE(json_extract(data, '$.country'), '') != 'AM'
      AND COALESCE(json_extract(data, '$.extractionVersion'), -1) != ?1
      -- A missing extractionVersion is JSON null, so COALESCE makes it eligible.
      AND NOT (
        json_extract(data, '$.sourceUnavailable') = 1
        AND typeof(json_extract(data, '$.sourceReviewAttemptedAt')) = 'text'
      )
    ORDER BY created_at ASC
    LIMIT ?2
  `).bind(EXTRACTION_VERSION, BACKFILL_BATCH_SIZE).all<StoredRow>());
  return result.results.map(row => JSON.parse(row.data) as Report);
}

export async function archivedListingSource(id: string) {
  const db = await database();
  const row = await withTimeout(db.prepare('SELECT source_text FROM report_sources WHERE report_id = ?1').bind(id).first<{ source_text: string }>());
  return row?.source_text || '';
}

export async function saveReport(item: Report) {
  item = normalizedReport(item);
  const db = await database();
  await withTimeout(db.prepare(`
    INSERT INTO reports (id, data, created_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data
  `)
    .bind(item.id, JSON.stringify(item), item.createdAt)
    .run());
  await invalidateReportHtml(item.id);
}

export async function replaceReport(item: Report) {
  item = normalizedReport(item);
  const db = await database();
  await withTimeout(db.prepare(`
    INSERT INTO reports (id, data, created_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at
  `).bind(item.id, JSON.stringify(item), item.createdAt).run());
  await invalidateReportHtml(item.id);
}

export async function comparisons() {
  const db = await database();
  const result = await withTimeout(db.prepare('SELECT data FROM comparisons ORDER BY created_at ASC').all<StoredRow>());
  return result.results.map(row => JSON.parse(row.data) as Comparison);
}

export async function comparison(id: string) {
  const db = await database();
  return parse<Comparison>(await withTimeout(db.prepare('SELECT data FROM comparisons WHERE id = ?1').bind(id).first<StoredRow>()));
}

export async function saveComparison(item: Comparison) {
  const db = await database();
  await withTimeout(db.prepare('INSERT INTO comparisons (id, data, created_at) VALUES (?1, ?2, ?3)')
    .bind(item.id, JSON.stringify(item), item.createdAt)
    .run());
}
