import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel injects an adapter that makes Next 16.3 skip next-server.js.nft.json,
  // crashing the standalone finalizer (ENOENT). Standalone is unused on Vercel,
  // so disable it there; keep it locally for the bun standalone runtime.
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
