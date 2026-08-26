import { canonicalSource } from './display.ts';

export async function stableReportId(source: string, text = '') {
  const fingerprint = canonicalSource(source).slice(0, 500);
  const content = source.startsWith('http') ? '' : text;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${fingerprint}\n${content}`));
  return [...new Uint8Array(digest)].slice(0, 8).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
