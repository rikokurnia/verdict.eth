import type { NextConfig } from 'next';
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  devIndicators: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'coin-images.coingecko.com', pathname: '/coins/images/**' }],
  },
};
export default config;
