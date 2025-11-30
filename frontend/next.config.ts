import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep your existing settings here:
  // reactStrictMode: true,

  turbopack: {
    // Ignore heavy folders that flood event watchers
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',  // likely already ignored but safe
    ],
  },
};

export default nextConfig;