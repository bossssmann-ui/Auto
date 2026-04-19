import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@auto/shared` ships raw TS (`"main": "src/index.ts"`) so Next needs to
  // transpile it like any app-level source, not treat it as pre-built JS.
  transpilePackages: ["@auto/shared"],
};

export default nextConfig;
