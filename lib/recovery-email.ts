import { normalizeEmail, validEmail } from './security.ts';

/**
 * Password accounts are unverified, so the recovery email cannot be changed.
 * Saving the same address still succeeds, which lets the display name update.
 */
export async function changeRecoveryEmail(db: D1Database, userId: string, emailInput: string, _now: string) {
  const email = normalizeEmail(emailInput);
  if (!validEmail(email)) throw new Error('invalid_email');
  const row = await db.prepare(`
    SELECT u.email, p.user_id AS credential
    FROM users u LEFT JOIN password_credentials p ON p.user_id = u.id
    WHERE u.id = ?1
  `).bind(userId).first<{ email: string | null; credential: string | null }>();
  if (!row?.credential) throw new Error('not_credentials_user');
  if ((row.email || '').toLowerCase() === email) return email;
  throw new Error('email_unverified');
}
