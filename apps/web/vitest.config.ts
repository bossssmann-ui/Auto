/**
 * Vitest scope: tests that live under `apps/web/lib/auction/__tests__/`.
 *
 * We keep this config local (not at the repo root) so Vitest does not
 * accidentally pick up the legacy root `vite.config.ts` used by the Vite
 * landing page.
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the workspace package to its TS source so Vitest transforms it.
      // Next.js resolves this via the `"main"` field in package.json; Vitest's
      // pure-Node resolver needs an explicit alias to the .ts entrypoint.
      "@auto/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
      // Mirror Next.js' `paths: { "@/*": ["./*"] }` from tsconfig.json so
      // tests can import app code with the same alias as pages/components.
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
