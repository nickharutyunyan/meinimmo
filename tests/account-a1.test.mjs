import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { isPersonalDocument } from '../cloudflare/routes.mjs';
import { deliverEmail } from '../lib/email/deliver.ts';
import { analyticsPageFields } from '../lib/identity/analytics.ts';
import { EMAIL_SEND_CAP_TAG, GLOBAL_DAILY_CAP, LIVE_TOKEN_CAP } from '../lib/identity/constants.ts';
import { authLinkUrl, resendAcceptedMessage, signInAcceptedMessage } from '../lib/identity/copy.ts';
import { takeLinkFragment } from '../lib/identity/fragment.ts';
import { beginEmailLink, completeEmailLink, inspectLink } from '../lib/identity/links.ts';
import { applyResetPassword, passwordStillMatches } from '../lib/identity/mailbox.ts';
import { previewEmailAllowed } from '../lib/identity/preview.ts';
import { consumeEmailToken } from '../lib/identity/tokens.ts';
import { safeReturnTo } from '../lib/return-to.ts';
import { hashPassword, randomToken, sha256Hex } from '../lib/security.ts';

const NOW = '2026-10-08T12:00:00.000Z';
const root = path.resolve(import.meta.dirname, '..');

function bindable(sql, values) {
  const ordered = [];
  const rewritten = sql.replace(/\?(\d+)/g, (_, index) => {
    ordered.push(values[Number(index) - 1]);
    return '?';
  });
  return { sql: rewritten, ordered };
}

function openAuth() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT COLLATE NOCASE UNIQUE,
      email TEXT COLLATE NOCASE UNIQUE,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      email_verified_at TEXT,
      CHECK (username IS NOT NULL OR email IS NOT NULL)
    );
    CREATE TABLE password_credentials (
      user_id TEXT PRIMARY KEY NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE TABLE email_tokens (
      token_hash TEXT PRIMARY KEY NOT NULL,
      purpose TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE,
      user_id TEXT,
      nonce_hash TEXT,
      return_to TEXT,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE auth_attempts (
      subject_key TEXT NOT NULL,
      window_start TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (subject_key, window_start)
    );
    CREATE TABLE oauth_accounts (
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, provider_user_id)
    );
  `);
  function apply(state) {
    const { sql, ordered } = bindable(state.sql, state.values);
    const statement = sqlite.prepare(sql);
    if (state.method === 'first') return statement.get(...ordered) ?? null;
    if (state.method === 'all') return statement.all(...ordered);
    return statement.run(...ordered);
  }
  function prepare(sql) {
    const state = { sql, values: [], method: 'run' };
    const api = {
      state,
      bind(...values) {
        state.values = values;
        return api;
      },
      first() {
        state.method = 'first';
        return Promise.resolve(apply(state));
      },
      all() {
        state.method = 'all';
        return Promise.resolve({ results: apply(state) });
      },
      run() {
        state.method = 'run';
        return Promise.resolve(apply(state));
      },
    };
    return api;
  }
  return {
    sqlite,
    prepare,
    batch(statements) {
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) {
          statement.state.method = 'run';
          apply(statement.state);
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return Promise.resolve([]);
    },
  };
}

function count(db, table) {
  return db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

async function createSession(db, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.parse(NOW) + 30 * 24 * 60 * 60 * 1000);
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?4)')
    .bind(tokenHash, userId, expiresAt.toISOString(), NOW).run();
  return { token, expiresAt };
}

function seedPasswordUser(db, { id = 'user-1', email = 'owner@example.com', verified = null, sessions = 1 } = {}) {
  db.sqlite.prepare(`
    INSERT INTO users (id, username, email, created_at, updated_at, email_verified_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, `name-${id}`, email, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', verified);
  db.sqlite.prepare(`
    INSERT INTO password_credentials (user_id, salt, password_hash, iterations, created_at)
    VALUES (?, 'salt', 'stored-hash', 100000, '2026-10-01T00:00:00.000Z')
  `).run(id);
  for (let index = 0; index < sessions; index += 1) {
    db.sqlite.prepare(`
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
      VALUES (?, ?, '2026-11-08T12:00:00.000Z', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
    `).run(`old-session-${id}-${index}`, id);
  }
}

async function start(db, email, { purpose = 'sign_in', ip = '203.0.113.10', mailConfigured = true, locale = 'en', returnTo = '/account' } = {}) {
  const sent = [];
  const result = await beginEmailLink(db, {
    email,
    locale,
    purpose,
    ip,
    nowIso: NOW,
    returnTo,
    mailConfigured,
    send: async (issued) => { sent.push(issued); },
  });
  return { result, sent };
}

test('safeReturnTo rejects schemes, protocol-relative paths, backslashes and control characters', () => {
  assert.equal(safeReturnTo('/account'), '/account');
  assert.equal(safeReturnTo('/de/account?plan=pro'), '/de/account?plan=pro');
  assert.equal(safeReturnTo('//evil.com'), '/account');
  assert.equal(safeReturnTo('https://evil.com'), '/account');
  assert.equal(safeReturnTo('/\\evil.com'), '/account');
  assert.equal(safeReturnTo('/%5Cevil.com'), '/account');
  assert.equal(safeReturnTo('/%2F%2Fevil.com'), '/account');
  assert.equal(safeReturnTo('/%0A/evil.com'), '/account');
  assert.equal(safeReturnTo('/account\r\nLocation: https://evil.com'), '/account');
});

test('analytics page fields keep the path and drop the query and the fragment', async () => {
  assert.deepEqual(analyticsPageFields({ origin: 'https://reviewahouse.com', pathname: '/auth/link' }), {
    page_location: 'https://reviewahouse.com/auth/link',
    page_path: '/auth/link',
  });
  const script = await readFile(new URL('../lib/identity/analytics.ts', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.equal(script.includes('location.search'), false);
  assert.equal(script.includes('location.hash'), false);
  assert.match(script, /page_path/);
  assert.match(layout, /ANALYTICS_CONFIG_SCRIPT/);
  assert.equal(layout.includes('location.search'), false);
});

test('a sign-in link is carried in the fragment', () => {
  const url = authLinkUrl('https://reviewahouse.com', 'de', 'token-value');
  assert.equal(url, 'https://reviewahouse.com/de/auth/link#t=token-value');
  assert.equal(url.includes('?'), false);
  const token = 'Y'.repeat(43);
  const first = takeLinkFragment({ pathname: '/auth/link', search: '', hash: `#t=${token}` }, null);
  assert.equal(first.token, token);
  assert.equal(first.url, '/auth/link');
  const second = takeLinkFragment({ pathname: '/auth/link', search: '', hash: '' }, first.held);
  assert.equal(second.token, token);
  assert.equal(second.url, null);
  const queryOnly = takeLinkFragment({ pathname: '/auth/link', search: `?t=${token}`, hash: '' }, null);
  assert.equal(queryOnly.token, '');
  const otherPath = takeLinkFragment({ pathname: '/de/auth/link', search: '', hash: '' }, first.held);
  assert.equal(otherPath.token, '');
});

test('a known address and an unknown address get the same sign-in acceptance', async () => {
  const knownDb = openAuth();
  seedPasswordUser(knownDb, { email: 'known@example.com' });
  const known = await start(knownDb, 'Known@Example.com');
  const unknown = await start(openAuth(), 'unknown@example.com');
  assert.equal(known.result.status, 202);
  assert.equal(unknown.result.status, 202);
  assert.deepEqual(known.result.body, { message: signInAcceptedMessage('known@example.com', 'en') });
  assert.deepEqual(unknown.result.body, { message: signInAcceptedMessage('unknown@example.com', 'en') });
  assert.equal(known.result.delivery, 'sent');
  assert.equal(unknown.result.delivery, 'sent');
  assert.equal(known.sent[0].tokenHash === known.sent[0].token, false);
});

test('resend looks the same when the account is missing and when it is unverified', async () => {
  const db = openAuth();
  seedPasswordUser(db, { email: 'known@example.com' });
  const known = await start(db, 'known@example.com', { purpose: 'verify_email' });
  const missing = await start(openAuth(), 'missing@example.com', { purpose: 'verify_email' });
  assert.equal(known.result.status, 202);
  assert.equal(missing.result.status, 202);
  assert.deepEqual(known.result.body, { message: resendAcceptedMessage('known@example.com', 'en') });
  assert.deepEqual(missing.result.body, { message: resendAcceptedMessage('missing@example.com', 'en') });
  assert.equal(known.result.delivery, 'sent');
  assert.equal(missing.result.delivery, 'skipped');
  assert.equal(missing.sent.length, 0);
});

test('an invalid email is rejected and an unconfigured sender fails closed with one message', async () => {
  const db = openAuth();
  const invalid = await start(db, 'not-an-email');
  assert.equal(invalid.result.status, 400);
  assert.deepEqual(invalid.result.body, { error: 'Enter a valid email address.' });
  const first = await start(db, 'one@example.com', { mailConfigured: false });
  const second = await start(openAuth(), 'two@example.com', { mailConfigured: false });
  assert.equal(first.result.status, 503);
  assert.deepEqual(first.result.body, second.result.body);
  assert.equal(count(db, 'email_tokens'), 0);
});

test('a new link leaves earlier unexpired links usable', async () => {
  const db = openAuth();
  const first = await start(db, 'owner@example.com');
  const second = await start(db, 'owner@example.com');
  assert.equal(count(db, 'email_tokens'), 2);
  const older = await consumeEmailToken(db, first.sent[0].token, NOW);
  const newer = await inspectLink(db, second.sent[0].token, NOW, null);
  assert.equal(older.email, 'owner@example.com');
  assert.equal(newer.ok, true);
  assert.equal(db.sqlite.prepare('SELECT used_at FROM email_tokens WHERE token_hash = ?').get(second.sent[0].tokenHash).used_at, null);
});

test('the fourth live link is not sent and the first three stay unused', async () => {
  const db = openAuth();
  const issued = [];
  for (let index = 0; index < LIVE_TOKEN_CAP; index += 1) issued.push(await start(db, 'owner@example.com', { ip: `203.0.113.${index}` }));
  const extra = await start(db, 'owner@example.com', { ip: '203.0.113.50' });
  assert.equal(extra.result.status, 202);
  assert.equal(extra.result.delivery, 'skipped');
  assert.equal(count(db, 'email_tokens'), LIVE_TOKEN_CAP);
  assert.equal(extra.sent.length, 0);
  assert.equal(issued.every((item) => item.result.delivery === 'sent'), true);
});

test('the sixth request for one address and the twenty-first for one IP send nothing', async () => {
  const db = openAuth();
  for (let index = 0; index < 5; index += 1) {
    const result = await start(db, 'owner@example.com', { ip: `198.51.100.${index}` });
    assert.equal(result.result.delivery, 'sent');
    db.sqlite.prepare('UPDATE email_tokens SET used_at = ? WHERE used_at IS NULL').run(NOW);
  }
  const sixth = await start(db, 'owner@example.com', { ip: '198.51.100.20' });
  assert.equal(sixth.result.status, 202);
  assert.equal(sixth.result.delivery, 'skipped');
  assert.deepEqual(sixth.result.body, { message: signInAcceptedMessage('owner@example.com', 'en') });

  const other = openAuth();
  for (let index = 0; index < 20; index += 1) {
    const result = await start(other, `person${index}@example.com`, { ip: '198.51.100.8' });
    assert.equal(result.result.delivery, 'sent', `ip request ${index}`);
  }
  const twentyFirst = await start(other, 'person20@example.com', { ip: '198.51.100.8' });
  assert.equal(twentyFirst.result.status, 202);
  assert.equal(twentyFirst.result.delivery, 'skipped');
  assert.equal(count(other, 'email_tokens'), 20);
});

test('the global daily send cap blocks the next email and logs email_send_cap', async () => {
  const db = openAuth();
  db.sqlite.prepare(`
    INSERT INTO auth_attempts (subject_key, window_start, attempt_count, updated_at)
    VALUES ('email-send-global', '2026-10-08', ?, ?)
  `).run(GLOBAL_DAILY_CAP, NOW);
  const errors = [];
  const original = console.error;
  console.error = (message) => errors.push(String(message));
  try {
    const capped = await start(db, 'owner@example.com');
    assert.equal(capped.result.status, 202);
    assert.equal(capped.result.delivery, 'skipped');
    assert.deepEqual(capped.result.body, { message: signInAcceptedMessage('owner@example.com', 'en') });
    assert.equal(count(db, 'email_tokens'), 0);
  } finally {
    console.error = original;
  }
  assert.match(errors.join('\n'), new RegExp(EMAIL_SEND_CAP_TAG));
});

test('inspecting a link does not consume it, and a second completion is already used', async () => {
  const db = openAuth();
  const issued = await start(db, 'owner@example.com');
  const token = issued.sent[0].token;
  const inspected = await inspectLink(db, token, NOW, null);
  assert.deepEqual(inspected, { ok: true, email: 'owner@example.com', purpose: 'sign_in', nonceMatches: false });
  assert.equal(db.sqlite.prepare('SELECT used_at FROM email_tokens WHERE token_hash = ?').get(issued.sent[0].tokenHash).used_at, null);
  const first = await completeEmailLink(db, token, NOW, 'en', (userId) => createSession(db, userId));
  const second = await completeEmailLink(db, token, NOW, 'en', (userId) => createSession(db, userId));
  assert.equal(first.ok, true);
  assert.equal(first.email, 'owner@example.com');
  assert.deepEqual(second, { ok: false, reason: 'used' });
});

test('two concurrent completions of one token produce one session and no throw', async () => {
  const db = openAuth();
  const issued = await start(db, 'new-person@example.com');
  const token = issued.sent[0].token;
  const [first, second] = await Promise.all([
    completeEmailLink(db, token, NOW, 'en', (userId) => createSession(db, userId)),
    completeEmailLink(db, token, NOW, 'en', (userId) => createSession(db, userId)),
  ]);
  const wins = [first, second].filter((result) => result.ok);
  const losses = [first, second].filter((result) => !result.ok);
  assert.equal(wins.length, 1);
  assert.equal(losses.length, 1);
  assert.equal(losses[0].reason, 'used');
  assert.equal(count(db, 'users'), 1);
  assert.equal(count(db, 'sessions'), 1);
});

test('two first sign-ins for one new email create a single user and do not throw', async () => {
  const db = openAuth();
  const first = await start(db, 'same@example.com', { ip: '203.0.113.1' });
  const second = await start(db, 'same@example.com', { ip: '203.0.113.2' });
  const [left, right] = await Promise.all([
    completeEmailLink(db, first.sent[0].token, NOW, 'en', (userId) => createSession(db, userId)),
    completeEmailLink(db, second.sent[0].token, NOW, 'en', (userId) => createSession(db, userId)),
  ]);
  const results = [left, right];
  assert.equal(results.every((result) => result.ok || result.reason === 'used'), true);
  assert.equal(results.filter((result) => result.ok).length >= 1, true);
  assert.equal(count(db, 'users'), 1);
  const winner = results.find((result) => result.ok);
  assert.equal(typeof winner.userId, 'string');
});

test('mailbox proof wipes an unverified password and its sessions, and a later password login no longer matches', async () => {
  const db = openAuth();
  const password = await hashPassword('correct-horse1');
  seedPasswordUser(db, { id: 'squatter', email: 'victim@example.com' });
  db.sqlite.prepare('UPDATE password_credentials SET salt = ?, password_hash = ?, iterations = ? WHERE user_id = ?')
    .run(password.salt, password.hash, password.iterations, 'squatter');
  assert.equal(await passwordStillMatches('correct-horse1', password.salt, password.hash, password.iterations), true);
  const issued = await start(db, 'victim@example.com');
  const completed = await completeEmailLink(db, issued.sent[0].token, NOW, 'en', (userId) => createSession(db, userId));
  assert.equal(completed.ok, true);
  assert.equal(completed.wiped, true);
  assert.equal(count(db, 'password_credentials'), 0);
  assert.equal(db.sqlite.prepare('SELECT token_hash FROM sessions WHERE token_hash = ?').get('old-session-squatter-0'), undefined);
  assert.equal(db.sqlite.prepare('SELECT email_verified_at FROM users WHERE id = ?').get('squatter').email_verified_at, NOW);
  assert.equal(await passwordStillMatches('correct-horse1', password.salt, password.hash, password.iterations), true);
  assert.equal(db.sqlite.prepare('SELECT user_id FROM password_credentials WHERE user_id = ?').get('squatter'), undefined);
});

test('an existing password user who has not proved the mailbox can still match the stored hash and session', async () => {
  const db = openAuth();
  const password = await hashPassword('correct-horse1');
  seedPasswordUser(db, { id: 'legacy', email: 'legacy@example.com' });
  db.sqlite.prepare('UPDATE password_credentials SET salt = ?, password_hash = ?, iterations = ? WHERE user_id = ?')
    .run(password.salt, password.hash, password.iterations, 'legacy');
  const row = db.sqlite.prepare(`
    SELECT u.id FROM users u JOIN sessions s ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get('old-session-legacy-0', NOW);
  assert.equal(row.id, 'legacy');
  assert.equal(await passwordStillMatches('correct-horse1', password.salt, password.hash, password.iterations), true);
  assert.equal(db.sqlite.prepare('SELECT email_verified_at FROM users WHERE id = ?').get('legacy').email_verified_at, null);
});

test('a verified account keeps its password when a magic link is used', async () => {
  const db = openAuth();
  seedPasswordUser(db, { id: 'verified-user', email: 'verified@example.com', verified: '2026-10-02T00:00:00.000Z' });
  const issued = await start(db, 'verified@example.com');
  const completed = await completeEmailLink(db, issued.sent[0].token, NOW, 'en', (userId) => createSession(db, userId));
  assert.equal(completed.wiped, false);
  assert.equal(db.sqlite.prepare('SELECT password_hash FROM password_credentials WHERE user_id = ?').get('verified-user').password_hash, 'stored-hash');
  assert.equal(db.sqlite.prepare('SELECT token_hash FROM sessions WHERE token_hash = ?').get('old-session-verified-user-0').token_hash, 'old-session-verified-user-0');
  assert.equal(count(db, 'sessions'), 2);
});

test('resetting a password on an unverified account marks it verified and replaces the hash', async () => {
  const db = openAuth();
  seedPasswordUser(db, { id: 'reset-user', email: 'reset@example.com', sessions: 2 });
  await applyResetPassword(db, 'reset-user', 'replacement1', NOW);
  const credential = db.sqlite.prepare('SELECT salt, password_hash, iterations FROM password_credentials WHERE user_id = ?').get('reset-user');
  assert.equal(await passwordStillMatches('replacement1', credential.salt, credential.password_hash, credential.iterations), true);
  assert.equal(await passwordStillMatches('stored-hash', credential.salt, credential.password_hash, credential.iterations), false);
  assert.equal(db.sqlite.prepare('SELECT email_verified_at FROM users WHERE id = ?').get('reset-user').email_verified_at, NOW);
  assert.equal(count(db, 'sessions'), 0);
});

test('a missing nonce still allows an explicit completion and does not match the browser cookie', async () => {
  const db = openAuth();
  const issued = await start(db, 'owner@example.com');
  const lookedUp = await inspectLink(db, issued.sent[0].token, NOW, null);
  assert.equal(lookedUp.nonceMatches, false);
  assert.equal(lookedUp.email, 'owner@example.com');
  const matched = await inspectLink(db, issued.sent[0].token, NOW, issued.sent[0].nonce);
  assert.equal(matched.nonceMatches, true);
  const completed = await completeEmailLink(db, issued.sent[0].token, NOW, 'de', (userId) => createSession(db, userId));
  assert.equal(completed.ok, true);
  assert.equal(completed.redirect, '/account');
});

test('preview access requires a verified address on the list', () => {
  assert.equal(previewEmailAllowed('nick@example.com', null, 'nick@example.com'), false);
  assert.equal(previewEmailAllowed('Nick@Example.com', '2026-10-08T00:00:00.000Z', 'nick@example.com'), true);
  assert.equal(previewEmailAllowed('other@example.com', '2026-10-08T00:00:00.000Z', 'nick@example.com'), false);
});

test('the verification migration backfills Google-only rows and leaves password rows unverified', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT COLLATE NOCASE UNIQUE,
      email TEXT COLLATE NOCASE UNIQUE,
      display_name TEXT,
      stripe_customer_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE password_credentials (
      user_id TEXT PRIMARY KEY NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE oauth_accounts (
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, provider_user_id)
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
  `);
  sqlite.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('google-only', 'google@example.com', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
  sqlite.prepare(`INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES ('google', 'sub-1', 'google-only', '2026-09-01T00:00:00.000Z')`).run();
  sqlite.prepare(`INSERT INTO users (id, username, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run('both', 'both-name', 'both@example.com', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
  sqlite.prepare(`INSERT INTO password_credentials (user_id, salt, password_hash, iterations, created_at) VALUES ('both', 's', 'h', 1, '2026-09-01T00:00:00.000Z')`).run();
  sqlite.prepare(`INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES ('google', 'sub-2', 'both', '2026-09-01T00:00:00.000Z')`).run();
  sqlite.prepare(`INSERT INTO users (id, username, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run('password-only', 'password-name', 'password@example.com', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
  sqlite.prepare(`INSERT INTO password_credentials (user_id, salt, password_hash, iterations, created_at) VALUES ('password-only', 's', 'h', 1, '2026-09-01T00:00:00.000Z')`).run();
  sqlite.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES ('kept-session', 'password-only', '2026-12-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')`).run();
  const migration = await readFile(new URL('../auth-migrations/0004_email_verification.sql', import.meta.url), 'utf8');
  sqlite.exec(migration);
  assert.equal(sqlite.prepare('SELECT email_verified_at FROM users WHERE id = ?').get('google-only').email_verified_at, '2026-09-01T00:00:00.000Z');
  assert.equal(sqlite.prepare('SELECT email_verified_at FROM users WHERE id = ?').get('both').email_verified_at, null);
  assert.equal(sqlite.prepare('SELECT email_verified_at FROM users WHERE id = ?').get('password-only').email_verified_at, null);
  const surviving = sqlite.prepare(`
    SELECT u.id FROM users u JOIN sessions s ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get('kept-session', NOW);
  assert.equal(surviving.id, 'password-only');
  assert.throws(() => sqlite.prepare(`INSERT INTO user_roles (user_id, role, created_at) VALUES ('password-only', 'buyer', ?)`).run(NOW));
  sqlite.prepare(`INSERT INTO user_roles (user_id, role, created_at) VALUES ('password-only', 'admin', ?)`).run(NOW);
  const habitat = await readdir(new URL('../migrations', import.meta.url));
  assert.equal(habitat.some((name) => /email_token|user_roles|email_verified/.test(name)), false);
});

test('no application route grants a role', async () => {
  async function filesUnder(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const found = [];
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) found.push(...await filesUnder(full));
      else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) found.push(full);
    }
    return found;
  }
  const files = [
    ...await filesUnder(path.join(root, 'app')),
    ...await filesUnder(path.join(root, 'lib')),
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.equal(/INSERT\s+INTO\s+user_roles/i.test(source), false, file);
  }
  const signup = await readFile(path.join(root, 'app/api/auth/signup/route.ts'), 'utf8');
  assert.equal(signup.includes('createCredentialsUser'), false);
  assert.equal(signup.includes('409'), false);
  const verify = await readFile(path.join(root, 'app/api/auth/email/verify/route.ts'), 'utf8');
  assert.equal(/export async function GET/.test(verify), false);
  const page = await readFile(path.join(root, 'components/AuthLinkPage.tsx'), 'utf8');
  assert.match(page, /takeLinkFragment/);
  assert.match(page, /\/api\/auth\/email\/inspect/);
  const fragment = await readFile(path.join(root, 'lib/identity/fragment.ts'), 'utf8');
  assert.match(fragment, /location\.hash/);
});

test('account and auth documents are not served from the shared asset cache', async () => {
  assert.equal(isPersonalDocument('/account'), true);
  assert.equal(isPersonalDocument('/auth/link'), true);
  assert.equal(isPersonalDocument('/de/auth/link'), true);
  assert.equal(isPersonalDocument('/r/abcdefgh'), false);
  const worker = await readFile(path.join(root, 'cloudflare/worker.mjs'), 'utf8');
  assert.match(worker, /isPersonalDocument/);
  const sender = await readFile(path.join(root, 'lib/email/deliver.ts'), 'utf8');
  const mailbox = await readFile(path.join(root, 'lib/identity/mailbox.ts'), 'utf8');
  assert.equal(sender.includes('server-only'), false);
  assert.equal(mailbox.includes('server-only'), false);
  assert.equal(typeof deliverEmail, 'function');
});
