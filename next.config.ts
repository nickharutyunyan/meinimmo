import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = { output: 'standalone', turbopack: { root: __dirname } };
export default nextConfig;

initOpenNextCloudflareForDev();
