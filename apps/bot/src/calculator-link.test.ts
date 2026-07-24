/**
 * Focused tests for `buildCalculatorLink` (Phase 7.6.5).
 *
 * Run with:  npx tsx apps/bot/src/calculator-link.test.ts
 *
 * This file is intentionally standalone — it does NOT import from bot.ts
 * and does NOT depend on any `_test_*` hooks. Keeping the scope narrow
 * means the append behavior can be verified without wiring into the
 * broader bot.test.ts harness.
 */

import { buildCalculatorLink, type CalculatorLinkInput } from "./calculator-link.js";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${msg}`);
  }
}

const BASE = "https://example.test";

function parse(url: string): URLSearchParams {
  const q = url.split("?")[1] ?? "";
  return new URLSearchParams(q);
}

// ─── Gating ──────────────────────────────────────────────────────────
console.log("\n═══ Gating: calc-related conversations only ═══");

{
  const link = buildCalculatorLink({}, BASE);
  assert(link === null, "no intent + no stage → null (not a calc conversation)");
}
{
  const link = buildCalculatorLink({ activeIntent: "car_search", stage: "gathering" }, BASE);
  assert(link === null, "activeIntent=car_search → null");
}
{
  const link = buildCalculatorLink({ activeIntent: "auction_explanation" }, BASE);
  assert(link === null, "activeIntent=auction_explanation → null");
}
{
  const link = buildCalculatorLink({ activeIntent: "price_calc" }, BASE);
  assert(link != null && link.startsWith(`${BASE}/calculator?`), "activeIntent=price_calc → link emitted");
}
{
  const link = buildCalculatorLink({ stage: "ready_to_calculate" }, BASE);
  assert(link != null && link.includes("/calculator?"), "stage=ready_to_calculate → link emitted");
}
{
  const link = buildCalculatorLink(
    { activeIntent: "price_calc", vehicleTypeHint: "special" },
    BASE,
  );
  assert(link === null, "special vehicles → null (operator-only flow, no self-service link)");
}
{
  const link = buildCalculatorLink(
    { activeIntent: "price_calc", vehicleTypeHint: "special_vehicle" },
    BASE,
  );
  assert(link === null, "special_vehicle alias → null");
}

// ─── Param names match the web contract exactly ─────────────────────
console.log("\n═══ Param names match web /calculator page ═══");

{
  const full: CalculatorLinkInput = {
    activeIntent: "price_calc",
    vehicleTypeHint: "jeep",
    volumeCm3: 2500,
    year: new Date().getFullYear() - 4,
    fuelType: "gasoline",
    auctionPriceJPYLow: 1_200_000,
    auctionPriceJPYHigh: 1_800_000,
    isForResale: false,
    isLegalEntity: true,
    bodyText: "минивэн",
  };
  const link = buildCalculatorLink(full, BASE)!;
  const p = parse(link);
    assert(p.get("type") === "jeep", "type=jeep propagates");
    assert(p.get("volume") === "2500", "volume cm³ propagates as integer");
    assert(p.get("age") === "4", "age derived from year (now - 4)");
    assert(p.get("fuel") === "ice", "fuel: gasoline → ice (web enum)");
    assert(p.get("van") === "1", "van detected from 'минивэн' in bodyText");
    assert(p.get("lowJpy") === "1200000", "lowJpy mirrors auctionPriceJPYLow");
    assert(p.get("highJpy") === "1800000", "highJpy mirrors auctionPriceJPYHigh");
    assert(p.get("resale") === "0", "resale=0 for isForResale:false");
    assert(p.get("legal") === "1", "legal=1 for isLegalEntity:true");

    // Every link must carry all nine keys so the web decoder (which is
    // all-or-nothing) hydrates the form. See WEB_DEFAULTS comment.
    const required = ["type", "volume", "age", "fuel", "van", "lowJpy", "highJpy", "resale", "legal"];
    for (const k of required) assert(p.has(k), `required key '${k}' present`);

    // Reject any accidental param rename — keys are the canonical contract.
    const allowed = new Set(required);
    const unknown: string[] = [];
    for (const k of p.keys()) if (!allowed.has(k)) unknown.push(k);
    assert(unknown.length === 0, `no stray params (got: ${[...p.keys()].join(",")})`);
}

// ─── Fuel mapping (bot → web enum) ───────────────────────────────────
console.log("\n═══ Fuel mapping ═══");

{
  const cases: Array<[CalculatorLinkInput["fuelType"], string]> = [
    ["gasoline", "ice"],
    ["diesel", "diesel"],
    ["hybrid", "hybrid"],
    ["phev", "hybrid"],
    ["ev", "electric"],
  ];
  for (const [bot, web] of cases) {
    const link = buildCalculatorLink({ activeIntent: "price_calc", fuelType: bot }, BASE)!;
    assert(parse(link).get("fuel") === web, `${bot} → ${web}`);
  }
}

{
  const link = buildCalculatorLink(
    { activeIntent: "price_calc", fuelType: "ev", volumeCm3: 2000 },
    BASE,
  )!;
  assert(parse(link).get("volume") === "0", "electric forces volume=0 (web cross-field refine)");
}

// ─── Age-window derivation ───────────────────────────────────────────
console.log("\n═══ Age window → age years ═══");

{
  const l1 = buildCalculatorLink({ activeIntent: "price_calc", ageWindow: "passable" }, BASE)!;
  assert(parse(l1).get("age") === "4", "passable → age=4");

  const l2 = buildCalculatorLink(
    { activeIntent: "price_calc", ageWindow: "non_passable", nonPassableType: "under_3_years" },
    BASE,
  )!;
  assert(parse(l2).get("age") === "1", "non_passable under_3_years → age=1");

  const l3 = buildCalculatorLink(
    { activeIntent: "price_calc", ageWindow: "non_passable", nonPassableType: "over_5_years" },
    BASE,
  )!;
  assert(parse(l3).get("age") === "7", "non_passable over_5_years → age=7");

  const l4 = buildCalculatorLink({ activeIntent: "price_calc" }, BASE)!;
  assert(parse(l4).get("age") === "4", "no year / no window → age falls back to web default (4)");
}

// ─── VAN detection ───────────────────────────────────────────────────
console.log("\n═══ VAN detection ═══");

{
  const ok = (body: string) => {
    const p = parse(buildCalculatorLink({ activeIntent: "price_calc", bodyText: body }, BASE)!);
    return p.get("van") === "1";
  };
  assert(ok("VAN"), "body 'VAN' → van=1");
  assert(ok("это минивэн"), "body 'минивэн' → van=1");
  assert(ok("фургон"), "body 'фургон' → van=1");

  const link = buildCalculatorLink({ activeIntent: "price_calc", bodyText: "седан" }, BASE)!;
  assert(parse(link).get("van") === "0", "non-van body → van=0 (web default)");

  const link2 = buildCalculatorLink({ activeIntent: "price_calc" }, BASE)!;
  assert(parse(link2).get("van") === "0", "no body → van=0 (web default)");
}

// ─── Vehicle type normalization ──────────────────────────────────────
console.log("\n═══ Vehicle type normalization ═══");

{
  const link = buildCalculatorLink(
    { activeIntent: "price_calc", vehicleTypeHint: "restricted" },
    BASE,
  )!;
  assert(parse(link).get("type") === "car", "restricted → car (web has no 'restricted' enum)");

  const link2 = buildCalculatorLink({ activeIntent: "price_calc" }, BASE)!;
  assert(parse(link2).get("type") === "car", "no hint → car (safe default)");

  const link3 = buildCalculatorLink(
    { activeIntent: "price_calc", vehicleTypeHint: "moto" },
    BASE,
  )!;
  assert(parse(link3).get("type") === "moto", "moto propagates");
}

// ─── Base-URL handling ───────────────────────────────────────────────
console.log("\n═══ Base URL handling ═══");

{
  const link = buildCalculatorLink({ activeIntent: "price_calc" }, "https://example.test/")!;
  assert(link.startsWith("https://example.test/calculator?"), "trailing slash on base is stripped");

  const link2 = buildCalculatorLink({ activeIntent: "price_calc" }, "https://example.test///")!;
  assert(link2.startsWith("https://example.test/calculator?"), "multiple trailing slashes handled");
}

// ─── Single known price collapses low==high ─────────────────────────
console.log("\n═══ Price-range encoding ═══");

{
  const link = buildCalculatorLink(
    {
      activeIntent: "price_calc",
      auctionPriceJPYLow: 2_000_000,
      auctionPriceJPYHigh: 2_000_000,
    },
    BASE,
  )!;
  const p = parse(link);
  assert(p.get("lowJpy") === "2000000" && p.get("highJpy") === "2000000", "explicit JPY populates both bounds identically");

  const link2 = buildCalculatorLink({ activeIntent: "price_calc" }, BASE)!;
  const p2 = parse(link2);
  assert(
    p2.get("lowJpy") === "1500000" && p2.get("highJpy") === "2200000",
    "no JPY known → web defaults (1_500_000 / 2_200_000)",
  );
}

// ─── Round-trip: bot-emitted URL decodes cleanly via the web helper ──
console.log("\n═══ Round-trip with web decoder ═══");

{
  // Lazy import, resolved relative to this file so the test runs from any
  // working directory (a previous version hardcoded a CI checkout path).
  const { decodeCalculatorState } = await import(
    new URL("../../web/lib/calculator-url.ts", import.meta.url).href
  );

  const link = buildCalculatorLink(
    {
      activeIntent: "price_calc",
      vehicleTypeHint: "jeep",
      volumeCm3: 2500,
      year: new Date().getFullYear() - 4,
      fuelType: "gasoline",
      auctionPriceJPYLow: 1_200_000,
      auctionPriceJPYHigh: 1_800_000,
      isForResale: false,
      isLegalEntity: true,
      bodyText: "седан",
    },
    BASE,
  )!;
  const decoded = decodeCalculatorState(new URLSearchParams(link.split("?")[1]));
  assert(decoded !== null, "bot-emitted URL decodes on the web side (all 9 keys present)");
  if (decoded) {
    assert(decoded.vehicleType === "jeep", "decoded vehicleType=jeep");
    assert(decoded.volumeCm3 === 2500, "decoded volumeCm3=2500");
    assert(decoded.fuelType === "ice", "decoded fuelType=ice");
    assert(decoded.priceJpyLow === 1_200_000 && decoded.priceJpyHigh === 1_800_000, "decoded price bounds round-trip");
    assert(decoded.isForResale === false && decoded.isLegalEntity === true, "decoded booleans round-trip");
  }

  // Sparse input (only intent) also decodes — web form hydrates to defaults.
  const sparse = buildCalculatorLink({ activeIntent: "price_calc" }, BASE)!;
  const decodedSparse = decodeCalculatorState(new URLSearchParams(sparse.split("?")[1]));
  assert(decodedSparse !== null, "sparse bot URL (unknowns → defaults) decodes on web");
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n═══ Results ═══`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failed > 0) process.exit(1);
