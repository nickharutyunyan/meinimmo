import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { securityHeaders } from './lib/security-headers.ts';

function buildSha() {
  const fromEnv = process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.WORKERS_CI_COMMIT_SHA || '';
  const raw = (fromEnv || gitSha()).trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(raw) ? raw.slice(0, 7) : '';
}

function gitSha() {
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  env: { NEXT_PUBLIC_BUILD_SHA: buildSha() },
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
export default nextConfig;

initOpenNextCloudflareForDev();
