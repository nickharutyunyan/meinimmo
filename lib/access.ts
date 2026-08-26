import 'server-only';
import type { NextRequest } from 'next/server';
import { appEnvironment, authDatabase } from './auth-db';
import { anonymousToken, sessionUser } from './auth';
import { sha256Hex } from './security';
import { featureFlagEnabled } from './feature-flags';

export type AccessKind = 'free' | 'day_pass' | 'pro' | 'ultra';
export type AccessState = {
  authenticated: boolean;
  limitsEnabled: boolean;
  kind: AccessKind;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
};

export async function reportLimitsEnabled() {
  const env = await appEnvironment();
  return featureFlagEnabled(env.REPORT_LIMITS_ENABLED, false);
}

export type AllowanceReservation = {
  allowed: boolean;
  state: AccessState;
  release?: () => Promise<void>;
  userId?: string;
};

function berlinDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function nextBerlinMidnight(date = new Date()) {
  const tomorrow = new Date(date.getTime() + 36 * 60 * 60 * 1000);
  const datePart = berlinDay(tomorrow);
  const utcGuess = new Date(`${datePart}T00:00:00Z`);
  const offsetParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', timeZoneName: 'longOffset', hour: '2-digit' }).formatToParts(utcGuess);
  const offset = offsetParts.find((part) => part.type === 'timeZoneName')?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = offset ? (offset[1] === '+' ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3])) : 60;
  return new Date(utcGuess.getTime() - minutes * 60 * 1000).toISOString();
}

async function anonymousSubject(token: string) {
  return `a:${await sha256Hex(token)}`;
}

function userSubject(userId: string) {
  return `u:${userId}`;
}

type SubscriptionRow = { plan: 'pro' | 'ultra'; status: string; current_period_end: string | null };
type DayPassRow = { id: string; expires_at: string; report_limit: number; reports_used: number };

async function currentAccess(userId: string | undefined, anonymous: string, date = new Date()) {
  const db = await authDatabase();
  const now = date.toISOString();
  if (userId) {
    const subscription = await db.prepare(`
      SELECT plan, status, current_period_end FROM subscriptions
      WHERE user_id = ?1 AND status IN ('active', 'trialing')
        AND (current_period_end IS NULL OR current_period_end > ?2)
    `).bind(userId, now).first<SubscriptionRow>();
    if (subscription) return {
      kind: subscription.plan,
      limit: subscription.plan === 'ultra' ? 100 : 10,
      subject: userSubject(userId),
      usageDate: berlinDay(date),
      resetAt: nextBerlinMidnight(date),
    } as const;

    const dayPass = await db.prepare(`
      SELECT id, expires_at, report_limit, reports_used FROM day_passes
      WHERE user_id = ?1 AND expires_at > ?2
      ORDER BY expires_at ASC LIMIT 1
    `).bind(userId, now).first<DayPassRow>();
    if (dayPass) return { kind: 'day_pass' as const, dayPass, limit: dayPass.report_limit, resetAt: dayPass.expires_at };
  }
  return {
    kind: 'free' as const,
    limit: 2,
    subject: userId ? userSubject(userId) : await anonymousSubject(anonymous),
    usageDate: berlinDay(date),
    resetAt: nextBerlinMidnight(date),
  };
}

export async function accessState(request: NextRequest, anonymousTokenValue?: string): Promise<AccessState> {
  const user = await sessionUser(request);
  const limitsEnabled = await reportLimitsEnabled();
  if (!limitsEnabled) return {
    authenticated: Boolean(user), limitsEnabled: false, kind: 'free',
    limit: 2, used: 0, remaining: 2, resetAt: nextBerlinMidnight(),
  };
  const anonymous = anonymousTokenValue || anonymousToken(request).token;
  const access = await currentAccess(user?.id, anonymous);
  if (access.kind === 'day_pass') {
    return {
      authenticated: true, limitsEnabled: true,
      kind: access.kind,
      limit: access.limit,
      used: access.dayPass.reports_used,
      remaining: Math.max(0, access.limit - access.dayPass.reports_used),
      resetAt: access.resetAt,
    };
  }
  const db = await authDatabase();
  const usage = await db.prepare('SELECT report_count FROM daily_usage WHERE subject_key = ?1 AND usage_date = ?2')
    .bind(access.subject, access.usageDate).first<{ report_count: number }>();
  const used = usage?.report_count || 0;
  return { authenticated: Boolean(user), limitsEnabled: true, kind: access.kind, limit: access.limit, used, remaining: Math.max(0, access.limit - used), resetAt: access.resetAt };
}

export async function reserveReportAllowance(request: NextRequest, anonymousTokenValue?: string): Promise<AllowanceReservation> {
  const user = await sessionUser(request);
  const limitsEnabled = await reportLimitsEnabled();
  if (!limitsEnabled) return {
    allowed: true,
    userId: user?.id,
    state: { authenticated: Boolean(user), limitsEnabled: false, kind: 'free', limit: 2, used: 0, remaining: 2, resetAt: nextBerlinMidnight() },
  };
  const anonymous = anonymousTokenValue || anonymousToken(request).token;
  const access = await currentAccess(user?.id, anonymous);
  const db = await authDatabase();
  const now = new Date().toISOString();

  if (access.kind === 'day_pass') {
    const updated = await db.prepare(`
      UPDATE day_passes SET reports_used = reports_used + 1
      WHERE id = ?1 AND expires_at > ?2 AND reports_used < report_limit
      RETURNING reports_used
    `).bind(access.dayPass.id, now).first<{ reports_used: number }>();
    const used = updated?.reports_used ?? access.dayPass.reports_used;
    const state: AccessState = { authenticated: true, limitsEnabled: true, kind: 'day_pass', limit: access.limit, used, remaining: Math.max(0, access.limit - used), resetAt: access.resetAt };
    return {
      allowed: Boolean(updated), state, userId: user?.id,
      release: updated ? async () => { await db.prepare('UPDATE day_passes SET reports_used = MAX(0, reports_used - 1) WHERE id = ?1').bind(access.dayPass.id).run(); } : undefined,
    };
  }

  const updated = await db.prepare(`
    INSERT INTO daily_usage (subject_key, usage_date, report_count, updated_at) VALUES (?1, ?2, 1, ?3)
    ON CONFLICT(subject_key, usage_date) DO UPDATE SET report_count = report_count + 1, updated_at = excluded.updated_at
    WHERE report_count < ?4
    RETURNING report_count
  `).bind(access.subject, access.usageDate, now, access.limit).first<{ report_count: number }>();
  const used = updated?.report_count ?? access.limit;
  const state: AccessState = { authenticated: Boolean(user), limitsEnabled: true, kind: access.kind, limit: access.limit, used, remaining: Math.max(0, access.limit - used), resetAt: access.resetAt };
  return {
    allowed: Boolean(updated), state, userId: user?.id,
    release: updated ? async () => { await db.prepare('UPDATE daily_usage SET report_count = MAX(0, report_count - 1), updated_at = ?3 WHERE subject_key = ?1 AND usage_date = ?2').bind(access.subject, access.usageDate, new Date().toISOString()).run(); } : undefined,
  };
}

export async function mergeAnonymousUsage(userId: string, anonymousTokenValue: string | undefined) {
  if (!anonymousTokenValue) return;
  const db = await authDatabase();
  const anonymous = await anonymousSubject(anonymousTokenValue);
  const user = userSubject(userId);
  const date = berlinDay();
  const now = new Date().toISOString();
  const anonymousUsage = await db.prepare('SELECT report_count FROM daily_usage WHERE subject_key = ?1 AND usage_date = ?2').bind(anonymous, date).first<{ report_count: number }>();
  if (!anonymousUsage?.report_count) return;
  await db.prepare(`
    INSERT INTO daily_usage (subject_key, usage_date, report_count, updated_at) VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(subject_key, usage_date) DO UPDATE SET report_count = MIN(2, report_count + excluded.report_count), updated_at = excluded.updated_at
  `).bind(user, date, Math.min(2, anonymousUsage.report_count), now).run();
}

export async function rememberUserReport(userId: string | undefined, reportId: string) {
  if (!userId) return;
  const db = await authDatabase();
  await db.prepare('INSERT OR IGNORE INTO user_reports (user_id, report_id, created_at) VALUES (?1, ?2, ?3)')
    .bind(userId, reportId, new Date().toISOString()).run();
}

export async function userReportIds(userId: string) {
  const db = await authDatabase();
  const result = await db.prepare('SELECT report_id FROM user_reports WHERE user_id = ?1 ORDER BY created_at ASC').bind(userId).all<{ report_id: string }>();
  return result.results.map((row) => row.report_id);
}
