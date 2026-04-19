import { defineConfig } from 'vitest/config';

// Keep this config tightly scoped to @auto/shared so Vitest does not discover
// the root Vite landing config (which belongs to the legacy `src/` app).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
