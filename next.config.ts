import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import securityHeaders from './cloudflare/security-headers.json';

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: '/(.*)', headers: Object.entries(securityHeaders).map(([key, value]) => ({ key, value })) }];
  },
};
export default nextConfig;

initOpenNextCloudflareForDev();
