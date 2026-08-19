import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=()',
  },
];

const apiInternalOrigin = process.env.WB_API_INTERNAL_URL ?? 'http://127.0.0.1:3001/api';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        destination: `${apiInternalOrigin}/:path*`,
        source: '/backend/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: '/:path*',
      },
    ];
  },
};

export default nextConfig;
