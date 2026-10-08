import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { factFeedbackTablesReady, feedbackWindowStart } from './fact-feedback.ts';
import { withTimeout } from './io-timeout.ts';

async function database() {
  const { env } = await withTimeout(getCloudflareContext({ async: true }));
  if (!env.DB) throw new Error('The Cloudflare D1 binding "DB" is not configured.');
  return env.DB;
}

/** True when sqlite_master lists fact_feedback. Callers hide the form when this is false. */
export async function factFeedbackReady() {
  const db = await database();
  const result = await withTimeout(db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fact_feedback'
  `).all<{ name: string }>());
  return factFeedbackTablesReady((result.results || []).map(row => row.name));
}

/** Existence plus the stored extraction version. Does not parse the report JSON. */
export async function reportExtractionVersion(id: string) {
  const db = await database();
  const row = await withTimeout(db.prepare(`
    SELECT json_extract(data, '$.extractionVersion') AS extraction_version
    FROM reports WHERE id = ?1
  `).bind(id).first<{ extraction_version: number | null }>());
  if (!row) return undefined;
  return { extractionVersion: typeof row.extraction_version === 'number' ? row.extraction_version : null };
}

/** One cheap upsert per IP+report hour. Old windows for that key are dropped first. */
export async function recordFactFeedbackAttempt(subjectKey: string, now = new Date()) {
  const db = await database();
  const windowStart = feedbackWindowStart(now);
  await withTimeout(db.prepare('DELETE FROM fact_feedback_limits WHERE subject_key = ?1 AND window_start < ?2').bind(subjectKey, windowStart).run());
  const row = await withTimeout(db.prepare(`
    INSERT INTO fact_feedback_limits (subject_key, window_start, attempt_count)
    VALUES (?1, ?2, 1)
    ON CONFLICT(subject_key, window_start) DO UPDATE SET attempt_count = attempt_count + 1
    RETURNING attempt_count
  `).bind(subjectKey, windowStart).first<{ attempt_count: number }>());
  return row?.attempt_count || 1;
}

export async function insertFactFeedback(row: {
  id: string;
  reportId: string;
  field: string;
  reportedValue: string | null;
  suggestedValue: string | null;
  comment: string | null;
  extractionVersion: number | null;
  createdAt: string;
}) {
  const db = await database();
  await withTimeout(db.prepare(`
    INSERT INTO fact_feedback (id, report_id, field, reported_value, suggested_value, comment, extraction_version, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `).bind(row.id, row.reportId, row.field, row.reportedValue, row.suggestedValue, row.comment, row.extractionVersion, row.createdAt).run());
}
