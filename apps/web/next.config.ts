import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@auto/shared` ships raw TS (`"main": "src/index.ts"`) so Next needs to
  // transpile it like any app-level source, not treat it as pre-built JS.
  transpilePackages: ["@auto/shared"],

  images: {
    // Modern format preferences for next/image. AVIF first, then WebP.
    formats: ["image/avif", "image/webp"],
    // Auction-CDN allowlist. Empty today because fixtures serve local SVGs;
    // when the real provider lands, add its hostnames here.
    // Example:
    //   { protocol: "https", hostname: "cdn.uss-auction.example" },
    remotePatterns: [],
  },
};

export default nextConfig;
