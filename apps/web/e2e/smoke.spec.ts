/**
 * Smoke suite for the commercial-critical paths the April audit flagged:
 * mobile navigation, contacts form + Telegram CTA, calculator validation,
 * robots/sitemap URLs and console cleanliness.
 *
 * Deliberately behavioral (roles, labels, URLs) — no pixel assertions.
 * No external side effects: the lead form is only submitted empty (client
 * validation stops it), the calculator's CBR dependency degrades to the
 * operator card, which the test accepts as a valid outcome.
 */

import { expect, test, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// 1. Desktop: home → catalog → lot page
// ---------------------------------------------------------------------------

test.describe("desktop journey", () => {
  test.skip(({ isMobile }) => isMobile, "desktop-only journey");

  test("home → catalog → lot card opens a lot page", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Каталог" })
      .click();
    await expect(page).toHaveURL(/\/catalog/);

    const lotLink = page.locator('a[href^="/lot/"]').first();
    await expect(lotLink).toBeVisible();
    await lotLink.click();

    await expect(page).toHaveURL(/\/lot\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Lead CTA from P1-01 is present on the lot page.
    await expect(
      page.getByRole("button", { name: /Уточнить наличие/ }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Mobile 375–390px: hamburger menu navigation
// ---------------------------------------------------------------------------

test.describe("mobile navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile-only journey");

  test("hamburger opens the menu and navigates to calculator", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Калькулятор" }).click();
    await expect(page).toHaveURL(/\/calculator/);
  });

  test("hamburger navigates to contacts and closes after click", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Контакты" }).click();
    await expect(page).toHaveURL(/\/contacts/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("no horizontal overflow on the home page", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Contacts: validation + Telegram CTA
// ---------------------------------------------------------------------------

test.describe("contacts page", () => {
  test("empty form shows validation errors and does not submit", async ({ page }) => {
    await page.goto("/contacts");
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page.getByText("Укажите ваше имя")).toBeVisible();
    await expect(page.getByText("Укажите номер телефона")).toBeVisible();
    // Still on the form — no success state.
    await expect(page.getByText("Заявка отправлена")).toHaveCount(0);
  });

  test("Telegram CTA is a real t.me link", async ({ page }) => {
    await page.goto("/contacts");
    const cta = page.getByRole("link", { name: "Открыть бота" });
    await expect(cta).toHaveAttribute("href", /^https:\/\/t\.me\/.+/);
  });
});

// ---------------------------------------------------------------------------
// 4. Calculator: validation + result/operator fallback
// ---------------------------------------------------------------------------

test.describe("calculator", () => {
  test("inverted price range shows a validation error", async ({ page }) => {
    await page.goto("/calculator");
    await page.getByRole("spinbutton", { name: "от", exact: true }).fill("2000000");
    await page.getByRole("spinbutton", { name: "до", exact: true }).fill("1000000");
    await page.getByRole("button", { name: "Посчитать под ключ" }).click();
    await expect(
      page.getByText("Верхняя граница должна быть не меньше нижней"),
    ).toBeVisible();
  });

  test("valid input produces a result or an operator fallback", async ({ page }) => {
    await page.goto(
      // Pre-filled non-sanctioned car via URL state (spec §7.6.4).
      "/calculator?type=car&volume=1500&age=4&fuel=ice&van=0&lowJpy=1000000&highJpy=1500000&resale=0&legal=0",
    );
    await page.getByRole("button", { name: "Посчитать под ключ" }).click();

    // Either a price range card or the operator card (CBR unreachable) —
    // both are correct product behavior; a hang or error toast is not.
    await expect(
      page
        .getByText(/Под ключ в РФ|Передаю оператору/)
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// 5. robots.txt / sitemap.xml — no dev fallbacks in production build
// ---------------------------------------------------------------------------

test.describe("robots and sitemap", () => {
  test.skip(({ isMobile }) => isMobile, "protocol-level, one project is enough");

  test("robots.txt points at the real domain and carries Yandex directives", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Sitemap: https://stm-import.ru/sitemap.xml");
    expect(body).toContain("Clean-param: page&fuelType&ageWindow&brand /catalog");
    expect(body).toContain("Disallow: /api/");
    expect(body).not.toContain("example.com");
    expect(body).not.toContain(".invalid");
  });

  test("sitemap.xml has real URLs only", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("https://stm-import.ru/catalog");
    expect(body).not.toContain("example.com");
    expect(body).not.toContain(".invalid");
  });

  test("llms.txt is served as text and stays brand-clean", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("SpecTechMash");
    expect(body).not.toMatch(/Pacific Star|Тихоокеанская Звезда/);
  });
});

// ---------------------------------------------------------------------------
// 6. Console cleanliness on the main pages
// ---------------------------------------------------------------------------

const MAIN_PAGES = [
  "/",
  "/catalog",
  "/calculator",
  "/contacts",
  "/about",
  "/import-auto-japan",
  "/customs",
];

async function collectConsoleErrors(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  await page.goto(path, { waitUntil: "networkidle" });
  return errors;
}

test.describe("console errors", () => {
  test.skip(({ isMobile }) => isMobile, "checked once on desktop");

  for (const path of MAIN_PAGES) {
    test(`no console errors on ${path}`, async ({ page }) => {
      const errors = await collectConsoleErrors(page, path);
      expect(errors).toEqual([]);
    });
  }
});
