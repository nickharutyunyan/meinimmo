import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Comparison, Report } from './types';
import { canonicalCondition } from './property-condition.ts';
import { acquisitionCosts } from './finance.ts';
import { energyClassFromDemand, refreshDerivedReport } from './listing-parser.ts';

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
  const condition = canonicalCondition(item.facts.condition);
  const costs = acquisitionCosts(item.facts);
  const totalCost = item.facts.totalCost && item.facts.totalCost < item.facts.price
    ? (item.facts.buyerCosts ? costs.total : 0)
    : item.facts.totalCost;
  const energy = (!item.facts.energy || /not stated|unknown/i.test(item.facts.energy)) && item.facts.energyDemand
    ? energyClassFromDemand(item.facts.energyDemand) || item.facts.energy
    : item.facts.energy;
  const summary = condition === 'Renovated'
    ? item.summary.replace(/described as (?:saniert|renoviert|new condition|like new)/i, 'described as renovated')
    : item.summary;
  return condition === item.facts.condition && summary === item.summary && totalCost === item.facts.totalCost && energy === item.facts.energy
    ? item
    : refreshDerivedReport({ ...item, summary, facts: { ...item.facts, condition, totalCost, energy } });
}

export async function reports() {
  const db = await database();
  const result = await db.prepare('SELECT data FROM reports ORDER BY created_at ASC').all<StoredRow>();
  return result.results.map(row => normalizedReport(JSON.parse(row.data) as Report));
}

export async function report(id: string) {
  const db = await database();
  const item = parse<Report>(await db.prepare('SELECT data FROM reports WHERE id = ?1').bind(id).first<StoredRow>());
  return item ? normalizedReport(item) : undefined;
}

export async function saveReport(item: Report) {
  const db = await database();
  await db.prepare(`
    INSERT INTO reports (id, data, created_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data
  `)
    .bind(item.id, JSON.stringify(item), item.createdAt)
    .run();
}

export async function replaceReport(item: Report) {
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
