import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { nextBerlinMidnight } from '../lib/berlin-time.ts';
import { linkGoogleUser } from '../lib/google-identity.ts';
import { changeRecoveryEmail } from '../lib/recovery-email.ts';
import { readLightSession } from '../lib/session-view.ts';
import { USER_REPORT_PAGE_SIZE, userReportWindow } from '../lib/user-reports.ts';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function bindable(sql, values) {
  const ordered = [];
  const rewritten = sql.replace(/\?(\d+)/g, (_, index) => {
    ordered.push(values[Number(index) - 1]);
    return '?';
  });
  return { sql: rewritten, ordered };
}

function authDb() {
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
      updated_at TEXT NOT NULL,
      email_verified_at TEXT
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
  const stats = { prepares: 0, batches: 0, queries: [] };
  function apply(state) {
    const { sql, ordered } = bindable(state.sql, state.values);
    stats.queries.push(state.sql);
    const statement = sqlite.prepare(sql);
    if (/^\s*(select|with)\b/i.test(sql)) {
      if (/\blimit\s+1\b/i.test(sql) || state.method === 'first') return statement.get(...ordered) ?? null;
    }
    if (state.method === 'first') return statement.get(...ordered) ?? null;
    if (state.method === 'all') return statement.all(...ordered);
    statement.run(...ordered);
    return { success: true };
  }
  function prepare(sql) {
    stats.prepares += 1;
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
    stats,
    sqlite,
    prepare,
    batch(statements) {
      stats.batches += 1;
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

function seedPasswordAccount(db, { id, email, sessions = 1, displayName = null }) {
  db.sqlite.prepare(`
    INSERT INTO users (id, username, email, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, `user-${id}`, email, displayName, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
  db.sqlite.prepare(`
    INSERT INTO password_credentials (user_id, salt, password_hash, iterations, created_at)
    VALUES (?, 'salt', 'stored-hash', 100000, '2026-10-01T00:00:00.000Z')
  `).run(id);
  for (let index = 0; index < sessions; index += 1) {
    db.sqlite.prepare(`
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
      VALUES (?, ?, '2026-11-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
    `).run(`session-${id}-${index}`, id);
  }
}

test('Google does not link to an unverified password account, and the recovery email stays locked', async () => {
  const db = authDb();
  const columns = db.sqlite.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
  assert.equal(columns.includes('email_verified_at'), true);
  seedPasswordAccount(db, { id: 'attacker-account', email: 'victim@example.com', sessions: 2 });
  db.stats.batches = 0;
  await assert.rejects(() => linkGoogleUser(db, 'google-sub-1', 'Victim@Example.com', '2026-10-08T18:00:00.000Z'), /unverified_account/);
  assert.equal(count(db, 'password_credentials'), 1);
  assert.equal(count(db, 'sessions'), 2);
  assert.equal(count(db, 'oauth_accounts'), 0);
  assert.equal(count(db, 'users'), 1);
  assert.equal(db.stats.batches, 0);
  assert.equal(db.sqlite.prepare('SELECT email FROM users WHERE id = ?').get('attacker-account').email, 'victim@example.com');
  assert.equal(db.sqlite.prepare('SELECT password_hash FROM password_credentials').get().password_hash, 'stored-hash');
  await assert.rejects(() => changeRecoveryEmail(db, 'attacker-account', 'other@example.com', '2026-10-08T18:00:00.000Z'), /email_unverified/);
  assert.equal(await changeRecoveryEmail(db, 'attacker-account', 'victim@example.com', '2026-10-08T18:00:00.000Z'), 'victim@example.com');
  assert.equal(db.sqlite.prepare('SELECT email FROM users WHERE id = ?').get('attacker-account').email, 'victim@example.com');
});

test('an existing Google identity is reused, and a passwordless account with the same email can take another Google id', async () => {
  const db = authDb();
  db.sqlite.prepare(`
    INSERT INTO users (id, email, created_at, updated_at) VALUES ('google-user', 'owner@example.com', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
  `).run();
  db.sqlite.prepare(`
    INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES ('google', 'google-sub-2', 'google-user', '2026-10-01T00:00:00.000Z')
  `).run();
  const again = await linkGoogleUser(db, 'google-sub-2', 'owner@example.com', '2026-10-08T18:00:00.000Z');
  assert.equal(again.id, 'google-user');
  assert.equal(count(db, 'oauth_accounts'), 1);
  const linked = await linkGoogleUser(db, 'google-sub-extra', 'owner@example.com', '2026-10-08T18:00:00.000Z');
  assert.equal(linked.id, 'google-user');
  assert.equal(count(db, 'users'), 1);
  assert.equal(count(db, 'password_credentials'), 0);
});

test('Google sign-in for a new email does not remove another account', async () => {
  const db = authDb();
  seedPasswordAccount(db, { id: 'someone-else', email: 'other@example.com', sessions: 1 });
  const linked = await linkGoogleUser(db, 'google-sub-3', 'new@example.com', '2026-10-08T18:00:00.000Z');
  assert.notEqual(linked.id, 'someone-else');
  assert.equal(linked.email, 'new@example.com');
  assert.equal(count(db, 'password_credentials'), 1);
  assert.equal(count(db, 'sessions'), 1);
  assert.equal(count(db, 'users'), 2);
  assert.equal(db.sqlite.prepare('SELECT user_id FROM oauth_accounts').get().user_id, linked.id);
});

test('a password account cannot change its recovery email, and a Google-only account is not a credential account', async () => {
  const db = authDb();
  seedPasswordAccount(db, { id: 'locked', email: 'locked@example.com' });
  await assert.rejects(() => changeRecoveryEmail(db, 'locked', 'not-an-email', '2026-10-08T18:00:00.000Z'), /invalid_email/);
  await assert.rejects(() => changeRecoveryEmail(db, 'locked', 'other@example.com', '2026-10-08T18:00:00.000Z'), /email_unverified/);
  assert.equal(db.sqlite.prepare('SELECT email FROM users WHERE id = ?').get('locked').email, 'locked@example.com');
  assert.equal(await changeRecoveryEmail(db, 'locked', 'Locked@Example.com', '2026-10-08T18:00:00.000Z'), 'locked@example.com');
  db.sqlite.prepare(`
    INSERT INTO users (id, email, created_at, updated_at) VALUES ('google-only', 'google@example.com', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
  `).run();
  await assert.rejects(() => changeRecoveryEmail(db, 'google-only', 'other@example.com', '2026-10-08T18:00:00.000Z'), /not_credentials_user/);
});

test('a light session read is one D1 query and treats a password account as unverified', async () => {
  const db = authDb();
  seedPasswordAccount(db, { id: 'member', email: 'member@example.com', displayName: 'Anna Schmidt', sessions: 1 });
  db.sqlite.prepare('UPDATE sessions SET token_hash = ? WHERE user_id = ?').run('hashed-token', 'member');
  db.stats.prepares = 0;
  db.stats.queries = [];
  const user = await readLightSession(db, 'hashed-token', '2026-10-08T18:00:00.000Z');
  assert.equal(db.stats.prepares, 1);
  assert.equal(db.stats.queries.length, 1);
  assert.match(db.stats.queries[0], /token_hash = \?1/);
  assert.match(db.stats.queries[0], /email_verified_at/);
  assert.doesNotMatch(db.stats.queries[0], /user_reports|subscriptions|oauth_accounts|CASE/);
  assert.deepEqual(user, { firstName: 'Anna', email: 'member@example.com', verified: false, roles: [] });

  db.sqlite.prepare(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES ('google-member', 'google@example.com', 'Mira Klein', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
  `).run();
  db.sqlite.prepare(`
    INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at)
    VALUES ('google', 'google-member-sub', 'google-member', '2026-10-01T00:00:00.000Z')
  `).run();
  db.sqlite.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
    VALUES ('google-token', 'google-member', '2026-11-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
  `).run();
  db.sqlite.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run('2026-10-01T00:00:00.000Z', 'google-member');
  db.stats.prepares = 0;
  db.stats.queries = [];
  const googleUser = await readLightSession(db, 'google-token', '2026-10-08T18:00:00.000Z');
  assert.equal(db.stats.prepares, 1);
  assert.equal(db.stats.queries.length, 1);
  assert.deepEqual(googleUser, { firstName: 'Mira', email: 'google@example.com', verified: true, roles: [] });

  db.stats.prepares = 0;
  db.stats.queries = [];
  assert.equal(await readLightSession(db, 'hashed-token', '2026-12-01T00:00:00.000Z'), null);
  assert.equal(db.stats.prepares, 1);
  assert.equal(db.stats.queries.length, 1);
});

test('session and account routes stay private, and report history is bounded', async () => {
  const session = await source('app/api/session/route.ts');
  const account = await source('app/api/account/route.ts');
  const nav = await source('components/AccountNav.tsx');
  const page = await source('components/AccountPage.tsx');
  const access = await source('lib/access.ts');
  const wrangler = await source('wrangler.jsonc');
  const migrations = await readdir(new URL('../auth-migrations', import.meta.url));
  assert.match(session, /readLightSession/);
  assert.doesNotMatch(session, /sessionUser|accessState|userReportIds|console\./);
  assert.match(session, /private, no-store, max-age=0/);
  assert.match(session, /Vary', 'Cookie'/);
  assert.doesNotMatch(session, /public,\s|s-maxage/);
  assert.match(account, /requireSameOrigin\(request\)/);
  assert.match(account, /email_unverified/);
  assert.match(account, /Bestätige diese E-Mail-Adresse, bevor du sie änderst/);
  assert.match(account, /Confirm this email before you change it/);
  assert.match(nav, /\/api\/session/);
  assert.doesNotMatch(nav, /\/api\/auth\/me/);
  assert.match(page, /\/api\/auth\/me/);
  assert.match(page, /kannst du sie noch nicht ändern/);
  assert.match(page, /isn’t confirmed yet, so you can’t change it/);
  assert.doesNotMatch(page, /immobilienscout|immoscout|ohne-makler|kleinanzeigen|immowelt|immonet/i);
  assert.match(access, /ORDER BY created_at DESC LIMIT \?2 OFFSET \?3/);
  assert.equal(USER_REPORT_PAGE_SIZE, 50);
  assert.deepEqual(userReportWindow(null), { page: 1, limit: 50, offset: 0 });
  assert.deepEqual(userReportWindow('2'), { page: 2, limit: 50, offset: 50 });
  assert.equal(userReportWindow('0').page, 1);
  assert.equal(userReportWindow('1.5').page, 1);
  assert.equal(userReportWindow('99999').limit, 50);
  assert.equal(userReportWindow('99999').offset, 199 * 50);
  assert.equal(migrations.some((name) => name.startsWith('0004_')), true);
  assert.match(await source('lib/google-identity.ts'), /unverified_account/);
  assert.doesNotMatch(await source('lib/google-identity.ts'), /DELETE FROM password_credentials/);
  assert.doesNotMatch(wrangler, /GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/);
});

test('the next Berlin midnight is the coming midnight at 10:00, 13:00 and 23:30, including the 2026 DST switches', () => {
  const lastSunday = (year, monthIndex) => {
    const last = new Date(Date.UTC(year, monthIndex + 1, 0));
    return last.getUTCDate() - last.getUTCDay();
  };
  assert.equal(lastSunday(2026, 2), 29);
  assert.equal(lastSunday(2026, 9), 25);

  const expectMidnight = (instant, resetAt) => {
    assert.equal(nextBerlinMidnight(new Date(instant)), resetAt, instant);
  };

  // 8 Oct 2026 is CEST (UTC+2). 20:40 Berlin was the live case that jumped a day.
  for (const instant of ['2026-10-08T08:00:00.000Z', '2026-10-08T11:00:00.000Z', '2026-10-08T21:30:00.000Z', '2026-10-08T18:40:00.000Z']) {
    expectMidnight(instant, '2026-10-08T22:00:00.000Z');
  }

  // Last Sunday of March 2026, after the 02:00 CET → 03:00 CEST switch.
  for (const instant of ['2026-03-29T08:00:00.000Z', '2026-03-29T11:00:00.000Z', '2026-03-29T21:30:00.000Z']) {
    expectMidnight(instant, '2026-03-29T22:00:00.000Z');
  }
  // The midnight that opens that Sunday is still CET.
  for (const instant of ['2026-03-28T09:00:00.000Z', '2026-03-28T12:00:00.000Z', '2026-03-28T22:30:00.000Z']) {
    expectMidnight(instant, '2026-03-28T23:00:00.000Z');
  }

  // Last Sunday of October 2026, after the 03:00 CEST → 02:00 CET switch.
  for (const instant of ['2026-10-25T09:00:00.000Z', '2026-10-25T12:00:00.000Z', '2026-10-25T22:30:00.000Z']) {
    expectMidnight(instant, '2026-10-25T23:00:00.000Z');
  }
  // The midnight that opens that Sunday is still CEST.
  for (const instant of ['2026-10-24T08:00:00.000Z', '2026-10-24T11:00:00.000Z', '2026-10-24T21:30:00.000Z']) {
    expectMidnight(instant, '2026-10-24T22:00:00.000Z');
  }
});
