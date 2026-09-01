import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@supabase/supabase-js'
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

