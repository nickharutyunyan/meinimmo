import { sha256Hex } from '../security.ts';
import { EMAIL_SEND_CAP_TAG, GLOBAL_DAILY_CAP, LINK_EMAIL_LIMIT, LINK_IP_LIMIT } from './constants.ts';

type BudgetDb = Pick<D1Database, 'prepare'>;

function hourWindow(nowIso: string) {
  const nowMs = Date.parse(nowIso);
  return new Date(Math.floor(nowMs / 3_600_000) * 3_600_000).toISOString();
}

async function bump(db: BudgetDb, subjectKey: string, windowStart: string, nowIso: string) {
  const row = await db.prepare(`
    INSERT INTO auth_attempts (subject_key, window_start, attempt_count, updated_at) VALUES (?1, ?2, 1, ?3)
    ON CONFLICT(subject_key, window_start) DO UPDATE SET attempt_count = attempt_count + 1, updated_at = excluded.updated_at
    RETURNING attempt_count
  `).bind(subjectKey, windowStart, nowIso).first<{ attempt_count: number }>();
  return Number(row?.attempt_count ?? 1);
}

export async function reserveLinkAttempt(db: BudgetDb, email: string, ip: string, nowIso: string) {
  const windowStart = hourWindow(nowIso);
  const emailCount = await bump(db, await sha256Hex(`link-email\n${email}`), windowStart, nowIso);
  const ipCount = await bump(db, await sha256Hex(`link-ip\n${ip}`), windowStart, nowIso);
  return emailCount > LINK_EMAIL_LIMIT || ipCount > LINK_IP_LIMIT ? 'limited' as const : 'ok' as const;
}

export async function reserveGlobalSend(db: BudgetDb, nowIso: string) {
  const windowStart = nowIso.slice(0, 10);
  const count = await bump(db, 'email-send-global', windowStart, nowIso);
  if (count > GLOBAL_DAILY_CAP) {
    console.error(JSON.stringify({ tag: EMAIL_SEND_CAP_TAG, window: windowStart, limit: GLOBAL_DAILY_CAP, count }));
    return 'capped' as const;
  }
  return 'ok' as const;
}
