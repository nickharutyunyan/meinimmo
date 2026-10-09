import { normalizeEmail, validEmail } from './security.ts';

export async function changeRecoveryEmail(db: D1Database, userId: string, emailInput: string, now: string) {
  const email = normalizeEmail(emailInput);
  if (!validEmail(email)) throw new Error('invalid_email');
  const row = await db.prepare(`
    SELECT u.email, u.email_verified_at, p.user_id AS credential
    FROM users u LEFT JOIN password_credentials p ON p.user_id = u.id
    WHERE u.id = ?1
  `).bind(userId).first<{ email: string | null; email_verified_at: string | null; credential: string | null }>();
  if (!row?.credential) throw new Error('not_credentials_user');
  if ((row.email || '').toLowerCase() === email) return email;
  if (!row.email_verified_at) throw new Error('email_unverified');
  const taken = await db.prepare('SELECT id FROM users WHERE email = ?1 COLLATE NOCASE AND id <> ?2')
    .bind(email, userId).first<{ id: string }>();
  if (taken) throw new Error('email_taken');
  await db.prepare('UPDATE users SET email = ?1, updated_at = ?2 WHERE id = ?3').bind(email, now, userId).run();
  return email;
}
