import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { authDatabase, publicUser, type SessionUser, type UserRow } from './auth-db';
import { linkGoogleUser } from './google-identity';
import { changeRecoveryEmail } from './recovery-email';
import { hashPassword, normalizeEmail, randomToken, sha256Hex, validEmail, validPassword, verifyPassword } from './security';

export const SESSION_COOKIE = 'rah_session';
export const ANON_COOKIE = 'rah_anon';
export const OAUTH_COOKIE = 'rah_google_oauth';
export { LINK_NONCE_COOKIE } from './identity/constants.ts';
const SESSION_DAYS = 30;

function secureCookie(request: NextRequest) {
  return new URL(request.url).protocol === 'https:';
}

export function setPrivateCookie(response: NextResponse, request: NextRequest, name: string, value: string, maxAge: number) {
  response.cookies.set(name, value, { httpOnly: true, sameSite: 'lax', secure: secureCookie(request), path: '/', maxAge });
}

export function clearPrivateCookie(response: NextResponse, request: NextRequest, name: string) {
  response.cookies.set(name, '', { httpOnly: true, sameSite: 'lax', secure: secureCookie(request), path: '/', maxAge: 0 });
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

export async function createCredentialsUser(usernameInput: string, password: string, nameInput?: string, emailInput?: string) {
  const username = normalizeUsername(usernameInput);
  const email = normalizeEmail(emailInput || '');
  if (!validUsername(username)) throw new Error('invalid_username');
  if (!validEmail(email)) throw new Error('invalid_email');
  if (!validPassword(password)) throw new Error('invalid_password');
  const name = nameInput?.trim().slice(0, 80) || null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordData = await hashPassword(password);
  const db = await authDatabase();
  const existing = await db.prepare('SELECT username, email FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?2 COLLATE NOCASE LIMIT 1')
    .bind(username, email).first<{ username: string | null; email: string | null }>();
  if (existing?.username?.toLowerCase() === username) throw new Error('username_taken');
  if (existing?.email?.toLowerCase() === email) throw new Error('email_taken');
  try {
    await db.batch([
      db.prepare('INSERT INTO users (id, username, email, display_name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)').bind(id, username, email, name, now),
      db.prepare('INSERT INTO password_credentials (user_id, salt, password_hash, iterations, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, passwordData.salt, passwordData.hash, passwordData.iterations, now),
    ]);
  } catch (error) {
    if (/unique|constraint/i.test(String(error))) throw new Error('account_exists');
    throw error;
  }
  return { id, username, email, name, stripeCustomerId: null, emailVerified: false } satisfies SessionUser;
}

export async function authenticateCredentials(identifierInput: string, password: string) {
  const identifier = identifierInput.trim().toLowerCase();
  const db = await authDatabase();
  const row = await db.prepare(`
    SELECT u.id, u.username, u.email, u.display_name, u.stripe_customer_id, u.created_at,
      p.salt, p.password_hash, p.iterations
    FROM users u JOIN password_credentials p ON p.user_id = u.id
    WHERE u.username = ?1 COLLATE NOCASE OR u.email = ?1 COLLATE NOCASE
  `).bind(identifier).first<UserRow & { salt: string; password_hash: string; iterations: number }>();
  if (!row || !await verifyPassword(password, row.salt, row.password_hash, row.iterations)) return null;
  return publicUser(row);
}

export async function findOrCreateGoogleUser(providerUserId: string, emailInput: string) {
  const db = await authDatabase();
  const row = await linkGoogleUser(db, providerUserId, emailInput, new Date().toISOString());
  return publicUser(row);
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = await authDatabase();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?4)')
    .bind(tokenHash, userId, expiresAt.toISOString(), now.toISOString()).run();
  return { token, expiresAt };
}

export function attachSession(response: NextResponse, request: NextRequest, session: { token: string; expiresAt: Date }) {
  setPrivateCookie(response, request, SESSION_COOKIE, session.token, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
}

export async function sessionUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const db = await authDatabase();
  const row = await db.prepare(`
    SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id
    WHERE s.token_hash = ?1 AND s.expires_at > ?2
  `).bind(tokenHash, new Date().toISOString()).first<UserRow>();
  return row ? publicUser(row) : null;
}

export async function deleteSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const db = await authDatabase();
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256Hex(token)).run();
}

export function anonymousToken(request: NextRequest) {
  const existing = request.cookies.get(ANON_COOKIE)?.value;
  return existing && /^[A-Za-z0-9_-]{20,100}$/.test(existing) ? { token: existing, fresh: false } : { token: randomToken(18), fresh: true };
}

export function attachAnonymousCookie(response: NextResponse, request: NextRequest, anonymous: { token: string; fresh: boolean }) {
  if (anonymous.fresh) setPrivateCookie(response, request, ANON_COOKIE, anonymous.token, 365 * 24 * 60 * 60);
}

export async function updateDisplayName(userId: string, nameInput: string) {
  const name = nameInput.trim().slice(0, 80) || null;
  const db = await authDatabase();
  await db.prepare('UPDATE users SET display_name = ?1, updated_at = ?2 WHERE id = ?3').bind(name, new Date().toISOString(), userId).run();
  return name;
}

export async function updateRecoveryEmail(userId: string, emailInput: string) {
  const db = await authDatabase();
  return changeRecoveryEmail(db, userId, emailInput, new Date().toISOString());
}

export async function authRateLimited(request: NextRequest, identity: string) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const subject = await sha256Hex(`${ip}\n${identity.toLowerCase()}`);
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 900_000) * 900_000).toISOString();
  const db = await authDatabase();
  const result = await db.prepare(`
    INSERT INTO auth_attempts (subject_key, window_start, attempt_count, updated_at) VALUES (?1, ?2, 1, ?3)
    ON CONFLICT(subject_key, window_start) DO UPDATE SET attempt_count = attempt_count + 1, updated_at = excluded.updated_at
    RETURNING attempt_count
  `).bind(subject, windowStart, now.toISOString()).first<{ attempt_count: number }>();
  return (result?.attempt_count || 1) > 10;
}
