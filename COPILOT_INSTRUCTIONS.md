# COPILOT_INSTRUCTIONS.md

> **Role:** You are GitHub Copilot acting as a senior full-stack engineer. Follow this spec **literally** and **in the order of the phases**. Do not skip ahead. Do not invent features. When in doubt, prefer the smallest working change.

> **Project context:** This repository currently hosts a Russian-speaking Telegram sales bot (`server/bot.ts`) for a Japanese/Korean/Chinese vehicle-import business (СпецТехМаш / Тихоокеанская Звезда). We are evolving it into a **monorepo** that also contains a new **SEO-optimized Next.js (App Router) catalog website** for Japanese auction lots. The bot must keep working throughout. Do not break it.

> **Non-negotiables:**
> - Do not touch `.env`, tokens, keys, amoCRM credentials, or production deploy config without an explicit instruction in the phase you are executing.
> - Do not rewrite `server/bot.ts` logic. Only move/share pieces that are explicitly requested.
> - Do not add runtime dependencies unless the phase says so.
> - Keep diffs small and review-friendly. One phase = one coherent PR-sized change.
> - TypeScript strict mode everywhere. No `any` unless there is literally no other option, and even then add a `// TODO:` note.

---

## 0. Current repository snapshot (for your awareness)

```
Auto-1/
├── server/
│   ├── bot.ts                 # Telegraf-based Telegram bot
│   ├── calculator.ts          # Customs + freight + sanctions price calc
│   └── test_openrouter.ts     # Diagnostic script
├── src/                       # Existing Vite+React landing (legacy)
├── public/
├── index.html                 # Vite entry for the legacy landing
├── package.json               # Contains Vite + Telegraf + Express deps
├── tsconfig.json              # Root TS config
├── tsconfig.app.json          # For Vite/React
├── tsconfig.node.json         # For server/*
├── vite.config.ts
├── CLAUDE.md
├── PROMPTS_WORKFLOW.md
└── README.md
```

The legacy Vite landing in `src/` is out of scope for this upgrade — **do not modify or delete it** unless a phase says so. The new site is a separate Next.js app.

---

## 1. ARCHITECTURE — Monorepo plan

Use a **pnpm workspaces monorepo** (fallback to npm workspaces if pnpm is not available — detect by presence of `pnpm-lock.yaml` and decide).

### 1.1 Target layout

```
Auto-1/                           # repo root (keep existing name)
├── apps/
│   ├── bot/                      # moved from ./server — Telegram bot
│   │   ├── src/
│   │   │   ├── bot.ts            # (moved from server/bot.ts, imports refactored)
│   │   │   └── test_openrouter.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                      # NEW — Next.js App Router catalog
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── public/
│       ├── next.config.ts
│       ├── tailwind.config.ts    # only if Tailwind v4 needs it; v4 prefers CSS-first
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                   # NEW — reusable business logic
│       ├── src/
│       │   ├── calculator/
│       │   │   ├── index.ts      # re-export
│       │   │   ├── customs.ts    # customs duty, утильсбор
│       │   │   ├── freight.ts    # freight incl. sanctioned rates
│       │   │   ├── sanctions.ts  # isSanctionedVehicle() + thresholds
│       │   │   └── types.ts      # CalcParams, CalcResult, etc.
│       │   ├── currency/
│       │   │   └── cbr.ts        # CBR daily rate fetch (if present today)
│       │   └── index.ts          # package barrel
│       ├── package.json          # name: "@auto/shared"
│       └── tsconfig.json
├── pnpm-workspace.yaml           # or `workspaces` in root package.json
├── package.json                  # root: scripts that fan out to workspaces
├── tsconfig.base.json            # shared compiler options
├── .gitignore                    # ensure .next/, node_modules/, .env*
├── CLAUDE.md                     # keep as-is
├── COPILOT_INSTRUCTIONS.md       # this file
└── README.md                     # update at the end
```

The **legacy `src/` and `index.html`** (Vite landing) stay at the root for now. If keeping them at the root conflicts with the monorepo tooling, move them under `apps/legacy-landing/` — but only if necessary and only in its own phase.

### 1.2 Package naming

- Shared package name: `@auto/shared` (internal, not published).
- Bot app: `@auto/bot`.
- Web app: `@auto/web`.

### 1.3 Workspace scripts (root `package.json`)

- `dev:bot` → run the bot in watch mode (`tsx watch apps/bot/src/bot.ts`).
- `dev:web` → `pnpm --filter @auto/web dev` (Next dev on port 3000).
- `build` → build all workspaces.
- `typecheck` → `tsc -b` across all workspaces.
- `lint` → ESLint across workspaces.

### 1.4 Runtime isolation

The bot and the web app **must not share a process**. They share code only via `@auto/shared`. No cross-imports between `apps/bot` and `apps/web`.

---

## 2. REFACTORING — Shared business logic

The existing `server/calculator.ts` and any sanctions/freight helpers in `server/bot.ts` must be lifted into `packages/shared/src/calculator/`.

### 2.1 What to extract verbatim (no behavior changes)

From `server/calculator.ts` (currently ~pure functions):
- `CalcParams` interface (including `fuelType`, `isVan`).
- `CalcSuccess` / `CalcFailure` / any result union types.
- `calculateTurnkeyPrice()` and every helper it calls.
- Customs-duty tables, утильсбор tables, engine-volume thresholds.
- `SANCTIONED_FREIGHT_USD` map, `SANCTIONED_VOLUME_THRESHOLD_CM3`, `MOTO_HUMAN_PRICE_THRESHOLD_JPY`.
- `isSanctionedVehicle()` helper.

From `server/bot.ts`, only extract utilities that are **not** Telegraf/OpenRouter-specific:
- Any `buildCalcParamsFromState()` logic that is pure (no bot state) — if it depends on bot state, leave a thin adapter in the bot and expose the pure core from shared.
- Currency conversion helpers if they live in bot.ts (CBR fetch, formatters).

### 2.2 How to refactor safely (procedure Copilot must follow)

1. Create `packages/shared` with empty barrels.
2. Copy — do not move yet — `calculator.ts` into `packages/shared/src/calculator/` and split it into `customs.ts`, `freight.ts`, `sanctions.ts`, `types.ts`. Preserve every numeric constant exactly. No rounding changes.
3. Re-export everything from `packages/shared/src/calculator/index.ts` and from `packages/shared/src/index.ts`.
4. Update `apps/bot/src/bot.ts` (previously `server/bot.ts`) to import from `@auto/shared` instead of the local file.
5. **Only after** `tsc` passes and a manual smoke test confirms calc output is identical, delete the old `server/calculator.ts`.
6. Add a Vitest suite in `packages/shared/` with ≥5 golden-sample tests (use real historical calculations from the bot logs — pick canonical cases: Honda Vezel base, Toyota Harrier 2.5 hybrid, Toyota Alphard (sanctioned VAN), moto > 600k JPY, diesel ICE > 1900cc).

### 2.3 Public API of `@auto/shared`

Exported surface (and nothing else):

```
// @auto/shared
export type { CalcParams, CalcResult, CalcSuccess, CalcFailure, FuelType } from "./calculator/types";
export { calculateTurnkeyPrice } from "./calculator";
export { isSanctionedVehicle } from "./calculator/sanctions";
export { fetchCbrDailyRates, type CbrRates } from "./currency/cbr"; // only if it exists today
```

Do not leak internal helpers.

---

## 3. TECH STACK (web app)

Mandatory versions (latest stable as of spec):

- **Next.js** 15+ with **App Router**. No Pages Router anywhere.
- **React** 19 (bundled with Next 15).
- **TypeScript** 5.x, `strict: true`.
- **Tailwind CSS v4** — use CSS-first config (`@import "tailwindcss"` + `@theme` in `globals.css`). Do **not** use a legacy `tailwind.config.js` unless absolutely required by a plugin.
- **shadcn/ui** — install via `npx shadcn@latest init` targeting `apps/web`. Use the **Neutral** base color and **New York** style. All shadcn components go in `apps/web/components/ui/`.
- **lucide-react** for icons (already shadcn-aligned).
- **next/font** loading **Inter** as primary and **Satoshi** (self-hosted woff2 in `apps/web/public/fonts/`) as display font. Inter is the default; Satoshi is only for hero/display headings.
- **zod** for runtime validation of auction API payloads.
- Data fetching: native `fetch` + Next.js `cache` / `revalidate`. No SWR, no TanStack Query unless a later phase justifies it.
- Linting: ESLint (Next's built-in config) + Prettier.
- Testing (later, optional): Vitest + Playwright. Not required in the initial phases.

Do **not** add: Redux, MobX, Zustand, Styled Components, Emotion, Chakra, MUI, SCSS.

---

## 4. UI/UX & DESIGN SYSTEM

**Aesthetic north star:** premium, minimal, high-end dealer showroom. Apple.com, Porsche Newsroom, Aston Martin Configurator. Never a generic used-car site.

### 4.1 Hard rules

- **No cheap gradients.** Allowed: a single, subtle radial glow behind hero. Forbidden: purple→pink, blue→cyan, any "glass-morphism" gradient cards.
- **No heavy shadows.** Maximum elevation is `shadow-sm` for interactive elements on hover. No `shadow-2xl`, no neon glows.
- **No rounded-full pill buttons everywhere.** Default radius is `rounded-xl` for cards, `rounded-lg` for buttons. Full-radius only for tag chips.
- **No emoji in UI copy.**
- **No stock hero photos of random cars.** Use negative space. Imagery comes from the real auction feed only.
- **No marketing fluff.** Copy is specific, technical, trustworthy (e.g., "1.5M ¥ FOB Japan · 4.5 grade · 43,000 km" rather than "Drive your dream today").

### 4.2 Layout system — strict Bento grid

- 12-column grid at `≥ lg`, collapsing to 6/4/2 at smaller breakpoints.
- Landing and catalog listings use **Bento tiles of unequal span** (e.g., one hero tile `col-span-8 row-span-2`, two secondary tiles `col-span-4`, etc.).
- Tile padding: `p-8` on desktop, `p-6` on tablet, `p-4` on mobile.
- Gap: `gap-4` mobile, `gap-6` desktop. Never larger.

### 4.3 Typography scale (define in `globals.css` via `@theme`)

- Display (Satoshi, weight 600): 72 / 56 / 40 px (desktop/tablet/mobile).
- H1 (Inter, weight 600): 48 / 40 / 32 px.
- H2 (Inter, weight 600): 32 / 28 / 24 px.
- H3 (Inter, weight 500): 24 / 22 / 20 px.
- Body (Inter, weight 400): 16 px / 15 px mobile, leading 1.6.
- Mono label (Inter with `font-variant: tabular-nums`, uppercase, tracking-widest, 12 px) for specs like "FOB JAPAN", "AUCTION GRADE".

### 4.4 Color tokens (light + dark, semantic)

Define in `@theme` — never use raw Tailwind color classes in components.

- `--color-bg` (light: `#FAFAFA`, dark: `#0A0A0A`)
- `--color-surface` (light: `#FFFFFF`, dark: `#111111`)
- `--color-surface-muted` (light: `#F4F4F5`, dark: `#171717`)
- `--color-border` (light: `#E4E4E7`, dark: `#1F1F1F`)
- `--color-fg` (light: `#0A0A0A`, dark: `#FAFAFA`)
- `--color-fg-muted` (light: `#52525B`, dark: `#A1A1AA`)
- `--color-accent` (single brand accent — deep graphite `#1A1A1A` in light, pearl `#F5F5F5` in dark; no neon)
- `--color-danger`, `--color-success` — muted, not saturated.

Default theme is **light**. Dark mode via `class="dark"` toggle in root layout. Persist preference in `localStorage` client-side only (allowed because this is the Next app, not a Claude artifact).

### 4.5 Motion

- Use Tailwind's built-in `transition` utilities. No Framer Motion in the first phases.
- Durations: 150 ms (micro), 300 ms (layout). Easing: `ease-out` for enter, `ease-in` for exit.
- No scroll-jacking. No parallax beyond a single hero background offset.

### 4.6 Component inventory (order of need)

Build in this order, one component per file, inside `apps/web/components/`:

1. `Shell/TopNav.tsx` — sticky, translucent, reveals border only after 8px scroll.
2. `Shell/Footer.tsx` — minimal, 3 columns.
3. `ui/*` — shadcn primitives (Button, Card, Badge, Input, Select, Sheet, Separator, Skeleton).
4. `BentoGrid.tsx` + `BentoTile.tsx` — generic layout primitives.
5. `Catalog/LotCard.tsx` — image, grade chip, model line, price line, "Under-key RUB" hint.
6. `Catalog/FilterBar.tsx` — brand/model/age/volume/fuel filters, URL-state synced.
7. `Lot/LotGallery.tsx`, `Lot/LotSpecs.tsx`, `Lot/LotCalculator.tsx`, `Lot/LotAuctionSheet.tsx`.
8. `Calculator/TurnkeyCalculator.tsx` — standalone page, uses `@auto/shared`.

---

## 5. SEO & ROUTING

### 5.1 URL structure

```
/                                          # Home (Bento hero + featured lots + value props)
/catalog                                   # All brands, featured filters
/catalog/[brand]                           # e.g. /catalog/toyota
/catalog/[brand]/[model]                   # e.g. /catalog/toyota/harrier
/catalog/[brand]/[model]/[generation]      # e.g. /catalog/toyota/harrier/xu80
/lot/[id]                                  # individual auction lot (canonical)
/calculator                                # standalone turnkey calculator
/about                                     # company, logistics, ТЛК
/contacts                                  # form + Telegram deep-link to the bot
/sitemap.xml                               # dynamic, generated from real lots
/robots.txt                                # allow all except /api/*
```

All `[brand]`, `[model]`, `[generation]` are **slugs** (lowercase, ASCII, `-` separated). Maintain a slug-map in `@auto/shared` so the bot and web agree on the same slug for "Toyota Harrier" → `toyota/harrier`.

### 5.2 Metadata & structured data

Every page implements Next 15 `generateMetadata`:

- Unique `<title>`: `{Model} {Generation} — under-key price from Japan | СпецТехМаш` (EN/RU later; start RU).
- `description`: specific, includes brand + model + generation + age window + starting under-key RUB price.
- Open Graph: image = primary lot photo (or a generated OG tile for category pages). `og:type = product` on lot pages.
- Twitter card: `summary_large_image`.
- Canonical URL set on every page.
- `hreflang` reserved — leave `ru` only for now, add stubs for `en` later.

Structured data (`application/ld+json`) to emit:

- Home: `Organization` + `WebSite` (with `SearchAction`).
- Category pages: `BreadcrumbList` + `ItemList`.
- Lot page: `Product` with `offers.priceCurrency: RUB`, `offers.price`, `vehicleIdentificationNumber` (if available), `brand`, `model`, `productionDate`, `mileageFromOdometer`.

### 5.3 Rendering strategy

- Catalog category pages: `export const revalidate = 3600` (ISR 1 h) + `generateStaticParams` for the top N popular brand/model combos. Unknown combos render on-demand.
- Lot pages: `revalidate = 300` (ISR 5 min) until the real API provides webhooks/on-demand revalidation.
- Home: revalidate = 600.
- Calculator page: fully static (`export const dynamic = "force-static"`). All heavy lifting client-side via `@auto/shared`.

### 5.4 Sitemap & robots

- `app/sitemap.ts` generates entries from the auction data layer: all lots + all category pages. Split into `sitemap-lots.xml` and `sitemap-catalog.xml` if > 50 000 URLs, using a sitemap index.
- `app/robots.ts`: allow all; disallow `/api/*`; reference sitemap.

### 5.5 Performance targets (CI-gated later)

- LCP < 2.0 s on 4G.
- CLS < 0.05.
- Images: `next/image` with `sizes` set explicitly. Auction photos served via a proxy route that forwards to the source CDN with `cache-control: public, max-age=86400, immutable`.
- Fonts: `display: "swap"`, preload only Inter 400/600 and Satoshi 600.

---

## 6. DATA LAYER — Auction API placeholders

The real auction API is **not yet available**. Build the data layer as a clean seam so swapping the mock for the real provider is a one-file change.

### 6.1 Location

`apps/web/lib/auction/`:

```
apps/web/lib/auction/
├── client.ts         # top-level typed client exported to app code
├── provider.ts       # interface: AuctionProvider
├── providers/
│   ├── mock.ts       # MockAuctionProvider (reads ./fixtures/*.json)
│   └── http.ts       # HttpAuctionProvider (stub, throws "not implemented")
├── mappers.ts        # raw-provider → UI view-model
├── schemas.ts        # zod schemas for raw + view-model
└── fixtures/
    ├── lots.json     # 20–30 realistic fake lots (JDM models we actually import)
    └── brands.json
```

### 6.2 The `AuctionProvider` interface (design only — Copilot must implement exactly this shape)

```ts
// apps/web/lib/auction/provider.ts (target shape, not code to run yet)
export interface AuctionProvider {
  listBrands(): Promise<Brand[]>;
  listModels(brandSlug: string): Promise<Model[]>;
  listGenerations(brandSlug: string, modelSlug: string): Promise<Generation[]>;

  searchLots(params: LotSearchParams): Promise<Paginated<LotListItem>>;
  getLot(id: string): Promise<LotDetail | null>;

  // Used by sitemap.ts and generateStaticParams
  listAllLotIds(): AsyncIterable<string>;
  listAllCategoryPaths(): AsyncIterable<{ brand: string; model?: string; generation?: string }>;
}
```

`LotSearchParams` includes: `brand`, `model`, `generation`, `ageWindow` (`"passable" | "non_passable_under3" | "non_passable_over5"`), `fuelType`, `volumeCm3Range`, `priceJpyRange`, `auctionGradeMin`, `page`, `pageSize`, `sort` (`"price_asc" | "price_desc" | "newest" | "ending_soon"`).

### 6.3 Selection

`client.ts` exports a singleton chosen via env:

- `AUCTION_PROVIDER=mock` (default in dev) → `MockAuctionProvider`.
- `AUCTION_PROVIDER=http` + `AUCTION_API_BASE_URL` → `HttpAuctionProvider`.

Never read env directly in components; only in `client.ts`.

### 6.4 View-model mapping

`mappers.ts` converts raw lot → `LotListItem` / `LotDetail`. The view-model must include a **pre-computed under-key price range (RUB)** via `@auto/shared`'s `calculateTurnkeyPrice`, called twice (low/high) using the lot's JPY price ± a configurable spread (default ±10%). This is what the UI renders. If `isSanctionedVehicle()` returns true, flag `requiresOperator: true` and the UI shows "price on request" instead of a number.

### 6.5 Mock fixtures

Seed `fixtures/lots.json` with 20–30 lots spanning: Toyota Harrier (hybrid, sanctioned), Honda Vezel (ICE, passable), Toyota Alphard (VAN, sanctioned), Toyota Prius 50, Subaru Forester, Lexus RX, Nissan Serena (VAN), Honda Fit, Toyota Land Cruiser Prado, a moto > 600k JPY (requires operator). Realistic prices in JPY, realistic mileages (km), realistic grades.

### 6.6 Caching

- `searchLots` — Next `fetch` `revalidate: 300`.
- `getLot` — `revalidate: 300`.
- `listBrands`, `listModels`, `listGenerations` — `revalidate: 3600`.
- Wrap with `unstable_cache` keyed by args so identical calls share cache entries.

### 6.7 Error handling

- All provider methods return typed values or throw `AuctionProviderError` (with `code: "not_found" | "upstream" | "timeout" | "validation"`).
- UI surfaces: `not_found` → 404 page; others → a minimal "temporary issue" card, no stack traces.

---

## 7. STEP-BY-STEP PHASES

Execute **one phase at a time**. After each phase: run `pnpm typecheck`, run the bot smoke-test (send a test message, confirm a calculation), and **stop for review**. Do not start Phase N+1 until the user confirms.

### Phase 1 — Monorepo skeleton (no feature changes)

Goal: bot keeps working from a new location; empty shared + web packages exist.

1. Add `pnpm-workspace.yaml` (or npm workspaces in root `package.json`) listing `apps/*` and `packages/*`.
2. Create `apps/bot/` with its own `package.json` and `tsconfig.json` extending a new `tsconfig.base.json`.
3. Move `server/bot.ts`, `server/calculator.ts`, `server/test_openrouter.ts` into `apps/bot/src/`. Update relative imports. Keep behavior **byte-for-byte identical** (same constants, same log strings).
4. Update root `package.json` scripts: `dev:bot`, `build`, `typecheck`, `lint`.
5. Create empty `packages/shared/` with `package.json` (name `@auto/shared`, `main`/`exports` pointing to `src/index.ts`) and a placeholder `src/index.ts`.
6. Create empty `apps/web/` via `pnpm create next-app@latest apps/web -- --ts --app --tailwind --eslint --src-dir=false --import-alias="@/*"` then **immediately** upgrade Tailwind to v4 following the official migration (CSS-first).
7. Verify: `pnpm --filter @auto/bot dev` starts the bot; `pnpm --filter @auto/web dev` serves the Next default page on :3000.
8. Commit message: `chore: restructure into pnpm monorepo (bot moved to apps/bot, web scaffold added)`.

**Do not** implement any UI or shared logic in this phase.

### Phase 2 — Extract shared calculator into `@auto/shared`

Goal: bot imports `calculateTurnkeyPrice` and `isSanctionedVehicle` from `@auto/shared`. Behavior unchanged.

1. Create `packages/shared/src/calculator/{types.ts,customs.ts,freight.ts,sanctions.ts,index.ts}`.
2. Move constants and functions from `apps/bot/src/calculator.ts` into these files, split by responsibility. Preserve every number.
3. Barrel re-export from `packages/shared/src/index.ts`.
4. Update imports in `apps/bot/src/bot.ts` (and anywhere else) to `@auto/shared`.
5. Delete `apps/bot/src/calculator.ts` only after `tsc` passes and a manual run confirms identical output for: Vezel base non-passable-over-5, Harrier 2.5 hybrid passable max trim (sanctioned), Alphard passable (sanctioned VAN), moto 700 000 ¥ (requires operator).
6. Add Vitest to `packages/shared` with the 5 golden tests listed in §2.2.6.
7. Commit message: `refactor(shared): extract calculator and sanctions logic into @auto/shared`.

### Phase 3 — Design system foundations in `apps/web`

Goal: empty pages render with the final typography, color tokens, layout primitives. No data yet.

1. Install shadcn/ui (`npx shadcn@latest init`) with Neutral + New York. Add components: Button, Card, Badge, Input, Select, Sheet, Separator, Skeleton, Dropdown-menu, Dialog.
2. Replace `globals.css` with Tailwind v4 CSS-first config: `@import "tailwindcss"` + `@theme` defining the color tokens and typography scale from §4.
3. Load Inter via `next/font/google` in `app/layout.tsx`. Add Satoshi woff2 to `public/fonts/` and configure via `next/font/local`.
4. Implement `components/Shell/TopNav.tsx`, `Shell/Footer.tsx`, `BentoGrid.tsx`, `BentoTile.tsx` exactly per §4.6 rules (no gradients, no heavy shadows).
5. Build **placeholder pages** (no real data): `/`, `/catalog`, `/catalog/[brand]`, `/catalog/[brand]/[model]`, `/catalog/[brand]/[model]/[generation]`, `/lot/[id]`, `/calculator`, `/about`, `/contacts`. Each uses the Shell + BentoGrid and shows dummy text matching the real information architecture.
6. Dark-mode toggle in TopNav, persisted via `localStorage`, no FOUC (use the shadcn recommended theme-provider pattern).
7. Lighthouse quick check on `/` — LCP < 2.5 s on dev.
8. Commit message: `feat(web): design-system foundations, shell, and page scaffolds`.

### Phase 4 — Auction data layer with mock provider

Goal: `/catalog/*` and `/lot/[id]` render from fixtures through the provider seam.

1. Implement `apps/web/lib/auction/` exactly per §6.
2. Create realistic `fixtures/lots.json` and `fixtures/brands.json` (§6.5).
3. Wire `MockAuctionProvider` into `client.ts` with `AUCTION_PROVIDER=mock` default.
4. Implement `mappers.ts` that calls `@auto/shared`'s `calculateTurnkeyPrice` twice per lot to produce low/high RUB. Flag sanctioned lots with `requiresOperator`.
5. Build `LotCard.tsx`, `FilterBar.tsx`, and fill catalog pages with real rendering from the mock.
6. Build the lot detail page: gallery placeholder (no real images yet — use `next/image` with a neutral placeholder SVG), specs, under-key range, auction-sheet stub, "Open in Telegram bot" CTA that deep-links to the existing bot with a pre-filled message (`https://t.me/<bot_username>?start=lot_{id}`).
7. `generateStaticParams` for top 10 brand/model combos from fixtures.
8. Implement `app/sitemap.ts` and `app/robots.ts` per §5.4 using the provider.
9. Commit message: `feat(web): auction data layer with mock provider and catalog rendering`.

### Phase 5 — SEO, structured data, and performance pass

Goal: every page ships correct metadata, JSON-LD, and green Lighthouse.

1. Implement `generateMetadata` on every route per §5.2.
2. Emit JSON-LD for Home (`Organization`, `WebSite` + `SearchAction`), category pages (`BreadcrumbList` + `ItemList`), and lot pages (`Product` + `Offer`).
3. Ensure canonical URLs on every page, consistent `og:image` (create a dynamic OG route `app/og/route.tsx` with `next/og` for category/lot pages).
4. Configure `next/image`, set `sizes` on every image, preconnect to any auction CDN domain (even the placeholder).
5. Add `next.config.ts` with `images.remotePatterns` for the eventual real CDN (commented allowlist for now).
6. Run Lighthouse on `/`, `/catalog`, `/catalog/toyota/harrier`, `/lot/<seeded-id>`. Target ≥ 95 on Performance, SEO, and Best Practices. Fix any regressions.
7. Commit message: `feat(web): metadata, structured data, and performance pass`.

### Phase 6 — Standalone calculator page + Telegram bot integration

Goal: `/calculator` works end-to-end in the browser using `@auto/shared`; the bot links to it and vice-versa.

1. Build `app/calculator/page.tsx` and `components/Calculator/TurnkeyCalculator.tsx`. Fields: vehicle type, engine volume, age window or year, JPY price range (low/high), fuel type, isVan, isForResale, isLegalEntity. Validate with zod client-side.
2. On submit: call `calculateTurnkeyPrice` twice (low/high) from `@auto/shared`, render "from X ₽ to Y ₽ under-key" and a factor-explanation list matching the bot's "ВИЛКА ЦЕНЫ" block.
3. If `isSanctionedVehicle()` is true → render an "operator required" card with a Telegram deep-link instead of numbers.
4. Add a `Share` button that encodes state into the URL (`/calculator?body=car&volumeCm3=2500&...`) so the bot can send the same link back.
5. In the bot's final reply, append a link to `/calculator?...` so customers can re-check on the web.
6. Final README update at the repo root explaining: what the monorepo is, how to run each app, how to deploy (Vercel for web, existing host for bot).
7. Commit message: `feat: unified turnkey calculator across bot and web`.

---

## 8. Definition of done (for the whole upgrade)

- `pnpm typecheck` passes at the root.
- `pnpm --filter @auto/bot dev` starts the bot and a manual Telegram calc matches pre-refactor output to the ruble.
- `pnpm --filter @auto/web build && pnpm --filter @auto/web start` serves the site on :3000 with:
  - Home, catalog, lot, calculator all rendering from the mock provider.
  - Lighthouse ≥ 95 on Performance/SEO/Best Practices.
  - Valid JSON-LD per Google's Rich Results Test.
- `@auto/shared` has unit tests covering all 5 golden calc cases, and both apps import from it.
- No `.env` secrets are committed. No new dependencies beyond those listed in §3 and §6.
- README at the repo root documents run/build/deploy for each app.

---

## 9. Stop conditions — ask the user first

Pause and ask before doing any of:
- Changing the Telegram bot's prompt logic or state machine.
- Touching amoCRM integration, webhook URLs, or production deploy config.
- Adding a database (Prisma, Postgres, etc.) — the first six phases must work purely with the mock provider.
- Introducing a new runtime dependency not in §3/§6.
- Removing the legacy Vite landing in `src/`.
- Merging to `main` or pushing to any remote.

End of spec.
