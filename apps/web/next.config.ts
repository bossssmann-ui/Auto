import type { NextConfig } from "next";

/**
 * Auction-CDN allowlist for next/image, driven by env so no code change is
 * needed when the photo host is decided. `NEXT_PUBLIC_AUCTION_CDN_ORIGIN` is
 * the same origin `app/layout.tsx` preconnects to.
 * Example: NEXT_PUBLIC_AUCTION_CDN_ORIGIN=https://cdn.stm-import.ru
 */
function cdnRemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const origin = process.env.NEXT_PUBLIC_AUCTION_CDN_ORIGIN;
  if (!origin) return [];
  try {
    const url = new URL(origin);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
      },
    ];
  } catch {
    console.warn(
      `[next.config] NEXT_PUBLIC_AUCTION_CDN_ORIGIN is not a valid URL: "${origin}" — remote images disabled.`,
    );
    return [];
  }
}

const nextConfig: NextConfig = {
  // `@auto/shared` ships raw TS (`"main": "src/index.ts"`) so Next needs to
  // transpile it like any app-level source, not treat it as pre-built JS.
  transpilePackages: ["@auto/shared"],

  images: {
    // Modern format preferences for next/image. AVIF first, then WebP.
    formats: ["image/avif", "image/webp"],
    remotePatterns: cdnRemotePatterns(),
  },
};

export default nextConfig;
