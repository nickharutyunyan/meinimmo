import { randomToken, sha256Hex } from '../security.ts';
import { safeReturnTo } from '../return-to.ts';
import { LIVE_TOKEN_CAP, SIGN_IN_TTL_MS, VERIFY_TTL_MS, type LinkPurpose } from './constants.ts';

type TokenDb = Pick<D1Database, 'prepare'>;

export type LiveToken = {
  token_hash: string;
  purpose: string;
  email: string;
  return_to: string | null;
  nonce_hash: string | null;
};

function ttl(purpose: LinkPurpose) {
  return purpose === 'sign_in' ? SIGN_IN_TTL_MS : VERIFY_TTL_MS;
}

export async function countLiveTokens(db: TokenDb, email: string, purpose: LinkPurpose, nowIso: string) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS n FROM email_tokens
    WHERE email = ?1 AND purpose = ?2 AND used_at IS NULL AND expires_at > ?3
  `).bind(email, purpose, nowIso).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function issueEmailToken(db: TokenDb, input: {
  email: string;
  purpose: LinkPurpose;
  nowIso: string;
  userId: string | null;
  returnTo: string | null | undefined;
}) {
  if (await countLiveTokens(db, input.email, input.purpose, input.nowIso) >= LIVE_TOKEN_CAP) return null;
  const token = randomToken(32);
  const nonce = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const nonceHash = await sha256Hex(nonce);
  const returnTo = input.returnTo ? safeReturnTo(input.returnTo, '') : '';
  const expiresAt = new Date(Date.parse(input.nowIso) + ttl(input.purpose)).toISOString();
  await db.prepare(`
    INSERT INTO email_tokens (token_hash, purpose, email, user_id, nonce_hash, return_to, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `).bind(tokenHash, input.purpose, input.email, input.userId, nonceHash, returnTo || null, expiresAt, input.nowIso).run();
  return { token, tokenHash, nonce };
}

export async function voidEmailToken(db: TokenDb, tokenHash: string, nowIso: string) {
  await db.prepare('UPDATE email_tokens SET used_at = ?1 WHERE token_hash = ?2 AND used_at IS NULL')
    .bind(nowIso, tokenHash).run();
}

export async function consumeEmailToken(db: TokenDb, rawToken: string, nowIso: string) {
  const tokenHash = await sha256Hex(rawToken);
  const row = await db.prepare(`
    UPDATE email_tokens SET used_at = ?2
    WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2
      AND purpose IN ('sign_in', 'verify_email')
    RETURNING token_hash, purpose, email, return_to, nonce_hash
  `).bind(tokenHash, nowIso).first<LiveToken>();
  return row ?? null;
}

export async function inspectEmailToken(db: TokenDb, rawToken: string, nowIso: string, nonceCookie: string | null) {
  const tokenHash = await sha256Hex(rawToken);
  const row = await db.prepare(`
    SELECT email, purpose, nonce_hash FROM email_tokens
    WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2
      AND purpose IN ('sign_in', 'verify_email')
  `).bind(tokenHash, nowIso).first<{ email: string; purpose: string; nonce_hash: string | null }>();
  if (!row) return { ok: false as const };
  const nonceMatches = Boolean(nonceCookie) && row.nonce_hash === await sha256Hex(nonceCookie || '');
  return { ok: true as const, email: row.email, purpose: row.purpose, nonceMatches };
}
