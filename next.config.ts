import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { CONTENT_SECURITY_POLICY } from './lib/content-security-policy.ts';

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: __dirname },
  async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },
};
export default nextConfig;

initOpenNextCloudflareForDev();
