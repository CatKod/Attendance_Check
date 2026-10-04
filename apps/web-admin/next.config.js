/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@apes/shared-types'],
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;