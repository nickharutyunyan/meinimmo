import 'server-only';
import { authDatabase } from './auth-db';
import { hashPassword, randomToken, sha256Hex, validPassword, validPasswordResetToken } from './security';

const RESET_MINUTES = 30;

export async function issuePasswordReset(identifierInput: string) {
  const identifier = identifierInput.trim().toLowerCase().slice(0, 254);
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const db = await authDatabase();
  const user = await db.prepare(`
    SELECT u.id, u.email
    FROM users u JOIN password_credentials p ON p.user_id = u.id
    WHERE (u.username = ?1 COLLATE NOCASE OR u.email = ?1 COLLATE NOCASE)
      AND u.email IS NOT NULL
    LIMIT 1
  `).bind(identifier).first<{ id: string; email: string }>();
  if (!user?.email) return null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_MINUTES * 60_000);
  await db.batch([
    db.prepare('UPDATE password_reset_tokens SET used_at = ?1 WHERE user_id = ?2 AND used_at IS NULL').bind(now.toISOString(), user.id),
    db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ?1').bind(now.toISOString()),
    db.prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(tokenHash, user.id, expiresAt.toISOString(), now.toISOString()),
  ]);
  return { token, tokenHash, email: user.email };
}

export async function revokePasswordReset(tokenHash: string) {
  const db = await authDatabase();
  await db.prepare('UPDATE password_reset_tokens SET used_at = ?1 WHERE token_hash = ?2 AND used_at IS NULL')
    .bind(new Date().toISOString(), tokenHash).run();
}

export async function resetPassword(token: string, password: string) {
  if (!validPasswordResetToken(token)) throw new Error('invalid_token');
  if (!validPassword(password)) throw new Error('invalid_password');
  const tokenHash = await sha256Hex(token);
  const db = await authDatabase();
  const now = new Date().toISOString();
  const reset = await db.prepare(`
    UPDATE password_reset_tokens SET used_at = ?2
    WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2
    RETURNING token_hash, user_id
  `).bind(tokenHash, now).first<{ token_hash: string; user_id: string }>();
  if (!reset) throw new Error('invalid_token');

  const passwordData = await hashPassword(password);
  await db.batch([
    db.prepare('UPDATE password_credentials SET salt = ?1, password_hash = ?2, iterations = ?3, created_at = ?4 WHERE user_id = ?5')
      .bind(passwordData.salt, passwordData.hash, passwordData.iterations, now, reset.user_id),
    db.prepare('UPDATE password_reset_tokens SET used_at = ?1 WHERE user_id = ?2 AND used_at IS NULL').bind(now, reset.user_id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(reset.user_id),
    db.prepare('UPDATE users SET updated_at = ?1 WHERE id = ?2').bind(now, reset.user_id),
  ]);
  return reset.user_id;
}
