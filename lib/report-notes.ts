import 'server-only';
import { authDatabase } from './auth-db';

export async function privateReportNote(userId: string, reportId: string) {
  const db = await authDatabase();
  return await db.prepare(`
    SELECT note, updated_at FROM report_notes
    WHERE user_id = ?1 AND report_id = ?2
  `).bind(userId, reportId).first<{ note: string; updated_at: string }>();
}

export async function savePrivateReportNote(userId: string, reportId: string, note: string) {
  const db = await authDatabase();
  const now = new Date().toISOString();
  if (!note.trim()) {
    await db.prepare('DELETE FROM report_notes WHERE user_id = ?1 AND report_id = ?2').bind(userId, reportId).run();
    return { note: '', updatedAt: now };
  }
  await db.prepare(`
    INSERT INTO report_notes (user_id, report_id, note, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?4)
    ON CONFLICT(user_id, report_id) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at
  `).bind(userId, reportId, note, now).run();
  return { note, updatedAt: now };
}
