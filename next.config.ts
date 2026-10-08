import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { securityHeaders } from './lib/security-headers.ts';

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
export default nextConfig;

initOpenNextCloudflareForDev();
