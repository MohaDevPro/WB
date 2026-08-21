/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/v0/:path*', destination: `${process.env.API_ORIGIN ?? 'http://localhost:4000'}/v0/:path*` }];
  },
};

export default nextConfig;
