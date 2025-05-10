import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ...any existing settings you have...

  typescript: {
    // ⚠️ skips all type checks during `next build`
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
