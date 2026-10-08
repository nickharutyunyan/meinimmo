import { CONTENT_SECURITY_POLICY } from './content-security-policy.ts';

/**
 * The only security header list. next.config.ts headers() and the Worker
 * (asset responses and report-cache hits) both apply this array.
 * CSP allows inline scripts with 'unsafe-inline' and does not use a nonce,
 * so a prerendered or cached document can include the GA snippet and Next's
 * bootstrap without a per-request nonce.
 */
export const securityHeaders: { key: string; value: string }[] = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

export function applySecurityHeaders(headers: Headers) {
  for (const { key, value } of securityHeaders) headers.set(key, value);
}
