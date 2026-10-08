import { normalizeEmail } from './security.ts';

export type GoogleAccountRow = {
  id: string;
  username: string | null;
  email: string | null;
  display_name: string | null;
  stripe_customer_id: string | null;
  created_at: string;
};

/**
 * Link Google only when the email is not already a password account.
 * Password accounts are unverified until a later confirmation flow, and this
 * deploy cannot record that on a new column. Refusing the link is what stops
 * a password sign-up from capturing a later Google sign-in.
 */
export async function linkGoogleUser(db: D1Database, providerUserId: string, emailInput: string, now: string): Promise<GoogleAccountRow> {
  const email = normalizeEmail(emailInput);
  const existing = await db.prepare(`
    SELECT u.* FROM users u JOIN oauth_accounts o ON o.user_id = u.id
    WHERE o.provider = 'google' AND o.provider_user_id = ?1
  `).bind(providerUserId).first<GoogleAccountRow>();
  if (existing) return existing;

  const matchingEmail = await db.prepare(`
    SELECT u.*, p.user_id AS credential
    FROM users u LEFT JOIN password_credentials p ON p.user_id = u.id
    WHERE u.email = ?1 COLLATE NOCASE
  `).bind(email).first<GoogleAccountRow & { credential: string | null }>();
  if (matchingEmail?.credential) throw new Error('unverified_account');
  if (matchingEmail) {
    await db.prepare("INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES ('google', ?1, ?2, ?3)")
      .bind(providerUserId, matchingEmail.id, now).run();
    return matchingEmail;
  }

  const id = crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO users (id, email, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)').bind(id, email, now),
    db.prepare("INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES ('google', ?1, ?2, ?3)").bind(providerUserId, id, now),
  ]);
  return {
    id,
    username: null,
    email,
    display_name: null,
    stripe_customer_id: null,
    created_at: now,
  };
}
