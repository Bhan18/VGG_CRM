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
  // Phone testing over LAN hits the dev server via a network IP/hostname,
  // which Next.js blocks by default. Extra origins (comma-separated) can be
  // allowed per machine via ALLOWED_DEV_ORIGINS in .env.local (gitignored).
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export default nextConfig;
