import { hashPassword, verifyPassword } from '../security.ts';

type MailboxDb = Pick<D1Database, 'prepare' | 'batch'>;

const stillUnverified = `EXISTS (SELECT 1 FROM users WHERE id = ?1 AND email_verified_at IS NULL)`;

export async function proveMailbox(db: MailboxDb, userId: string, nowIso: string) {
  const before = await db.prepare('SELECT email, email_verified_at FROM users WHERE id = ?1')
    .bind(userId).first<{ email: string | null; email_verified_at: string | null }>();
  if (!before) return 'missing' as const;
  if (before.email_verified_at) return 'already' as const;
  await db.batch([
    db.prepare(`DELETE FROM password_credentials WHERE user_id = ?1 AND ${stillUnverified}`).bind(userId),
    db.prepare(`DELETE FROM sessions WHERE user_id = ?1 AND ${stillUnverified}`).bind(userId),
    db.prepare(`
      UPDATE email_tokens SET used_at = ?2
      WHERE used_at IS NULL AND (email = ?3 OR user_id = ?1) AND ${stillUnverified}
    `).bind(userId, nowIso, before.email),
    db.prepare('UPDATE users SET email_verified_at = ?2, updated_at = ?2 WHERE id = ?1 AND email_verified_at IS NULL')
      .bind(userId, nowIso),
  ]);
  return 'verified' as const;
}

export async function ensureUser(db: Pick<D1Database, 'prepare'>, email: string, nowIso: string) {
  const id = crypto.randomUUID();
  try {
    await db.prepare(`
      INSERT INTO users (id, email, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?3)
      ON CONFLICT(email) DO NOTHING
    `).bind(id, email, nowIso).run();
  } catch (error) {
    if (!/unique|constraint/i.test(String(error))) throw error;
  }
  const row = await db.prepare('SELECT id, email_verified_at FROM users WHERE email = ?1 COLLATE NOCASE')
    .bind(email).first<{ id: string; email_verified_at: string | null }>();
  if (!row) throw new Error('user_insert_failed');
  return row;
}

export async function applyResetPassword(db: MailboxDb, userId: string, password: string, nowIso: string) {
  const passwordData = await hashPassword(password);
  await proveMailbox(db, userId, nowIso);
  const existing = await db.prepare('SELECT user_id FROM password_credentials WHERE user_id = ?1')
    .bind(userId).first<{ user_id: string }>();
  if (existing) {
    await db.prepare('UPDATE password_credentials SET salt = ?1, password_hash = ?2, iterations = ?3, created_at = ?4 WHERE user_id = ?5')
      .bind(passwordData.salt, passwordData.hash, passwordData.iterations, nowIso, userId).run();
  } else {
    await db.prepare('INSERT INTO password_credentials (user_id, salt, password_hash, iterations, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(userId, passwordData.salt, passwordData.hash, passwordData.iterations, nowIso).run();
  }
  await db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(userId).run();
  return passwordData;
}

export async function passwordStillMatches(password: string, salt: string, hash: string, iterations: number) {
  return verifyPassword(password, salt, hash, iterations);
}
