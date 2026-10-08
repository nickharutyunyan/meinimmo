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
  // This host only. A year-long includeSubDomains policy is a separate decision.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

export function applySecurityHeaders(headers: Headers) {
  for (const { key, value } of securityHeaders) headers.set(key, value);
}

/**
 * Paths Wrangler serves from the ASSETS binding without entering the worker.
 * Keep this list identical to the negated `run_worker_first` rules.
 */
export const DIRECT_ASSET_PATHS = ['/_next/static/*', '/downloads/*'] as const;

function securityHeader(name: string) {
  const header = securityHeaders.find(item => item.key.toLowerCase() === name.toLowerCase());
  if (!header) throw new Error(`Missing security header ${name}`);
  return header;
}

/** Cloudflare `_headers` for assets the worker script never sees. */
export function staticAssetHeadersFile(paths: readonly string[] = DIRECT_ASSET_PATHS) {
  const transport = securityHeader('Strict-Transport-Security');
  const sniffing = securityHeader('X-Content-Type-Options');
  const blocks = paths.map(assetPath => [
    assetPath,
    `  ${transport.key}: ${transport.value}`,
    `  ${sniffing.key}: ${sniffing.value}`,
  ].join('\n'));
  return `# Generated from lib/security-headers.ts. Assets that skip the worker.\n${blocks.join('\n')}\n`;
}
