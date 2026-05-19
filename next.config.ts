import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: 'dist',
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
