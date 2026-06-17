import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The repo root now has its own package-lock.json (for the Agentation MCP
  // tooling), so Next sees multiple lockfiles. Pin the tracing root to this app
  // so it doesn't infer the monorepo root.
  outputFileTracingRoot: __dirname,
  images: {
    // Allow Cloudinary-delivered media once configured.
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};

export default nextConfig;
