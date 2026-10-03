import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Comparison, Report } from './types';
import { canonicalCondition } from './property-condition.ts';
import { acquisitionCosts } from './finance.ts';
import { checkedCharacteristic, parseListing, looksLikePropertyListing, refreshDerivedReport } from './listing-parser.ts';

import { EXTRACTION_VERSION } from './report-integrity.ts';
import { fetchListing } from './listing-fetch.ts';
import { cleanReportAddress } from './location-validation.ts';

type StoredRow = { data: string };

async function database() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error('The Cloudflare D1 binding "DB" is not configured.');
  return env.DB;
}

function parse<T>(row: StoredRow | null) {
  return row ? JSON.parse(row.data) as T : undefined;
}

function normalizedReport(item: Report) {
  if (item.country === 'AM') return item;
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
  const summary = condition === 'Renovated'
    ? item.summary.replace(/described as (?:saniert|renoviert|new condition|like new)/i, 'described as renovated')
    : item.summary;
  const hasUnsupportedReserveConclusion = item.considerations.some(value => /WEG reserve is adequate/i.test(value));
  return condition === item.facts.condition && summary === item.summary && totalCost === item.facts.totalCost && energy === item.facts.energy
    && heating === item.facts.heating && energySource === item.facts.energySource && energyCertificate === item.facts.energyCertificate
    && !hasUnsupportedReserveConclusion
    ? item
    : refreshDerivedReport({ ...item, summary, facts: { ...item.facts, condition, totalCost, energy, heating, energySource, energyCertificate } });
}

export async function saveReportSource(id: string, source: string) {
  const db = await database();
  await db.prepare('INSERT INTO report_sources(report_id, source_text, saved_at) VALUES (?1, ?2, ?3) ON CONFLICT(report_id) DO UPDATE SET source_text = excluded.source_text, saved_at = excluded.saved_at').bind(id, source, new Date().toISOString()).run();
}

const refreshing = new Map<string, Promise<Report>>();
async function refreshSavedReport(item: Report): Promise<Report> {
  if (item.country === 'AM' || item.extractionVersion === EXTRACTION_VERSION) return normalizedReport(item);
  if (item.sourceReviewAttemptedAt && Date.now() - Date.parse(item.sourceReviewAttemptedAt) < 3600000) return normalizedReport(item);
  const pending = refreshing.get(item.id);
  if (pending) return pending;
  const task = (async () => {
    const db = await database();
    const attempted = new Date().toISOString();
    await db.prepare('INSERT OR IGNORE INTO report_revisions(report_id, extraction_version, data, replaced_at) VALUES (?1, ?2, ?3, ?4)').bind(item.id, item.extractionVersion || 0, JSON.stringify(item), attempted).run();
    try {
      const archived = await db.prepare('SELECT source_text FROM report_sources WHERE report_id = ?1').bind(item.id).first<{source_text: string}>();
      const source = archived?.source_text || (/^https?:/.test(item.source) ? await fetchListing(item.source) : '');
      if (!source || !looksLikePropertyListing(source)) throw new Error('source_unavailable');
      const parsed = parseListing(source, item.source);
      if (!parsed.facts.city && !parsed.location) throw new Error('location_unavailable');
      const fresh = { ...parsed, id: item.id, createdAt: item.createdAt, sourceFile: item.sourceFile, sourceReviewAttemptedAt: attempted };
      await saveReportSource(item.id, source);
      await replaceReport(fresh);
      return fresh;
    } catch {
      const stale = refreshDerivedReport({ ...item, extractionVersion: item.extractionVersion || 0, sourceUnavailable: true, sourceReviewAttemptedAt: attempted, aiFactChecked: false, aiLocationChecked: false, facts: { ...item.facts } });
      await replaceReport(stale);
      return stale;
    }
  })();
  refreshing.set(item.id, task);
  try { return await task; } finally { refreshing.delete(item.id); }
}

export async function reports() {
  const db = await database();
  const result = await db.prepare('SELECT data FROM reports ORDER BY created_at ASC').all<StoredRow>();
  return result.results.map(row => normalizedReport(JSON.parse(row.data) as Report));
}

export async function report(id: string) {
  const db = await database();
  const item = parse<Report>(await db.prepare('SELECT data FROM reports WHERE id = ?1').bind(id).first<StoredRow>());
  return item ? refreshSavedReport(item) : undefined;
}

export async function saveReport(item: Report) {
  item = normalizedReport(item);
  const db = await database();
  await db.prepare(`
    INSERT INTO reports (id, data, created_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data
  `)
    .bind(item.id, JSON.stringify(item), item.createdAt)
    .run();
}

export async function replaceReport(item: Report) {
  item = normalizedReport(item);
  const db = await database();
  await db.prepare(`
    INSERT INTO reports (id, data, created_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at
  `).bind(item.id, JSON.stringify(item), item.createdAt).run();
}

export async function comparisons() {
  const db = await database();
  const result = await db.prepare('SELECT data FROM comparisons ORDER BY created_at ASC').all<StoredRow>();
  return result.results.map(row => JSON.parse(row.data) as Comparison);
}

export async function comparison(id: string) {
  const db = await database();
  return parse<Comparison>(await db.prepare('SELECT data FROM comparisons WHERE id = ?1').bind(id).first<StoredRow>());
}

export async function saveComparison(item: Comparison) {
  const db = await database();
  await db.prepare('INSERT INTO comparisons (id, data, created_at) VALUES (?1, ?2, ?3)')
    .bind(item.id, JSON.stringify(item), item.createdAt)
    .run();
}
