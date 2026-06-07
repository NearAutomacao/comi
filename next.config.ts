import type { NextConfig } from 'next'

const isDesktopBuild = process.env.BUILD_TARGET === 'desktop'

const nextConfig: NextConfig = {
  // Standalone output for Electron packaging (includes server.js + minimal node_modules)
  ...(isDesktopBuild ? { output: 'standalone' } : { turbopack: {} }),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
