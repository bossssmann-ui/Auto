import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke/e2e config for the Next site.
 *
 * The web server is built and started by Playwright itself (`npm run build`
 * + `next start`) with a production SITE_URL baked in, so the robots/sitemap
 * assertions test the real deploy configuration. Against an already-running
 * server: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e`.
 *
 * No secrets required: the lead API degrades gracefully without Telegram
 * env, and tests never submit a valid lead form.
 */

const PORT = 3105;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }, // 393×852, isMobile, chromium
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: BASE_URL,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_SITE_URL: "https://stm-import.ru",
          NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: "spectechmash_bot",
          AUCTION_PROVIDER: "mock",
        },
      },
});
