import { normalizeEmail } from '../security.ts';

export function previewEmailAllowed(email: string | null | undefined, verifiedAt: string | null | undefined, allowlist: string | null | undefined) {
  if (!email || !verifiedAt || !allowlist) return false;
  const normalized = normalizeEmail(email);
  const allowed = allowlist.split(',').map((entry) => normalizeEmail(entry)).filter(Boolean);
  return allowed.includes(normalized);
}
