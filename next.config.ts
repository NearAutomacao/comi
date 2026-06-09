import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone: gera .next/standalone/server.js para o app Electron
  // turbopack: usado apenas no `next dev`, não afeta o build de produção
  output: 'standalone',
  turbopack: {},
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
        pathname: '/api/files/**',
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
