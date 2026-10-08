export type LightSessionUser = {
  firstName: string | null;
  email: string | null;
  verified: boolean;
  roles: string[];
};

export function firstNameFromDisplayName(displayName: string | null | undefined) {
  const first = displayName?.trim().split(/\s+/)[0] ?? '';
  return first ? first.slice(0, 30) : null;
}

/**
 * One indexed session read. A password account is unverified. Google, with no
 * password, is verified because the provider already proved the mailbox.
 * Roles arrive with a later migration. No new column is read.
 */
export async function readLightSession(db: D1Database, tokenHash: string, nowIso: string): Promise<LightSessionUser | null> {
  const row = await db.prepare(`
    SELECT u.display_name, u.email,
      CASE WHEN o.user_id IS NOT NULL AND p.user_id IS NULL THEN 1 ELSE 0 END AS verified
    FROM users u
    JOIN sessions s ON s.user_id = u.id
    LEFT JOIN oauth_accounts o ON o.user_id = u.id AND o.provider = 'google'
    LEFT JOIN password_credentials p ON p.user_id = u.id
    WHERE s.token_hash = ?1 AND s.expires_at > ?2
    LIMIT 1
  `).bind(tokenHash, nowIso).first<{ display_name: string | null; email: string | null; verified: number }>();
  if (!row) return null;
  return {
    firstName: firstNameFromDisplayName(row.display_name),
    email: row.email,
    verified: row.verified === 1,
    roles: [],
  };
}
