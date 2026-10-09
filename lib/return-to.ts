const ORIGIN = 'https://reviewahouse.com';

function decodedPath(value: string) {
  let current = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let next: string;
    try { next = decodeURIComponent(current); } catch { return null; }
    if (next === current) return current;
    current = next;
  }
  return current;
}

export function safeReturnTo(value: string | null | undefined, fallback = '/account') {
  if (!value) return fallback;
  const decoded = decodedPath(value);
  if (!decoded) return fallback;
  if (value.includes('\\') || decoded.includes('\\')) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(value) || /[\u0000-\u001F\u007F]/.test(decoded)) return fallback;
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('//')) return fallback;
  let url: URL;
  try { url = new URL(decoded, ORIGIN); } catch { return fallback; }
  if (url.origin !== ORIGIN || url.username || url.password) return fallback;
  if (url.pathname.includes('\\')) return fallback;
  return `${url.pathname}${url.search}`;
}
