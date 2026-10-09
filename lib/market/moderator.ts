import 'server-only';
import type { NextRequest } from 'next/server';
import { sessionUser } from '../auth.ts';
import { authDatabase } from '../auth-db.ts';

/**
 * The signed-in user, when they hold the moderator or admin role and have a verified email.
 * Roles are granted by an operator in AUTH_DB (user_roles); the app never grants them.
 */
export async function moderatorUser(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user || !user.emailVerified) return null;
  const db = await authDatabase();
  const row = await db.prepare("SELECT role FROM user_roles WHERE user_id = ?1 AND role IN ('admin', 'moderator') LIMIT 1").bind(user.id).first<{ role: string }>();
  return row ? { id: user.id, email: user.email, role: row.role } : null;
}
