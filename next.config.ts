import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

// Here we use the @cloudflare/next-on-pages next-dev module to allow us to use bindings during local development
// (when running the application with `next dev`), for more information see:
// https://github.com/cloudflare/next-on-pages/blob/main/internal-packages/next-dev/README.md
if (process.env.NODE_ENV === 'development') {
  // Removed await, as it was causing "ReferenceError: await is not defined"
    setupDevPlatform();
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Cloudflare specific features
  // images: {
  //   unoptimized: true, // Required for Cloudflare Pages
  // },
  // output: 'standalone',
};

export default nextConfig;
