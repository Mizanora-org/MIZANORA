/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The preview host is served from *.e2b.app — allow dev requests from it.
  allowedDevOrigins: ['*.e2b.app', '*.e2b.dev', 'localhost', '127.0.0.1'],
  devIndicators: false,
  // Stop Next inferring the monorepo root from the parent lockfile.
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
