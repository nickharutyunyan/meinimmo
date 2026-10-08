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

export async function readLightSession(db: D1Database, tokenHash: string, nowIso: string): Promise<LightSessionUser | null> {
  const row = await db.prepare(`
    SELECT u.display_name, u.email, u.email_verified_at
    FROM users u
    JOIN sessions s ON s.user_id = u.id
    WHERE s.token_hash = ?1 AND s.expires_at > ?2
    LIMIT 1
  `).bind(tokenHash, nowIso).first<{ display_name: string | null; email: string | null; email_verified_at: string | null }>();
  if (!row) return null;
  return {
    firstName: firstNameFromDisplayName(row.display_name),
    email: row.email,
    verified: Boolean(row.email_verified_at),
    roles: [],
  };
}
