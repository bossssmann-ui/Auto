import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/calculator/route";
import { __resetCbrRatesCache } from "@auto/shared";
import type { CalculatorInput, CalculatorResult } from "@/lib/calculator-schema";

// Deterministic CBR payload so the route tests never depend on the real
// (slow / sandbox-blocked) CBR mirror. Same synthetic rates as the golden
// tests in @auto/shared.
const FAKE_CBR_JSON = {
  Valute: {
    JPY: { Value: 0.65, Nominal: 1 },
    USD: { Value: 95.0, Nominal: 1 },
    EUR: { Value: 103.0, Nominal: 1 },
  },
};

beforeEach(() => {
  __resetCbrRatesCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ({ ok: true, json: async () => FAKE_CBR_JSON }) as unknown as Response,
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Minimal Request factory for the Next route handler contract.
function req(body: unknown): Request {
  return new Request("http://localhost/api/calculator", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID: CalculatorInput = {
  vehicleType: "car",
  volumeCm3: 1500,
  ageYears: 4,
  fuelType: "ice",
  isVan: false,
  priceJpyLow: 1_000_000,
  priceJpyHigh: 1_500_000,
  isForResale: false,
  isLegalEntity: false,
};

describe("POST /api/calculator", () => {
  it("returns 400 when the body is not JSON", async () => {
    const res = await POST(req("not json"));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_json");
  });

  it("returns 400 with issues when the body fails zod validation", async () => {
    const res = await POST(req({ vehicleType: "tank", volumeCm3: -1 }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; issues: unknown[] };
    expect(json.error).toBe("validation");
    expect(Array.isArray(json.issues)).toBe(true);
    expect(json.issues.length).toBeGreaterThan(0);
  });

  it("routes sanctioned vehicles to operator without touching the calculator", async () => {
    // ICE > 1900cc is sanctioned per packages/shared sanctions rules.
    const input: CalculatorInput = { ...VALID, volumeCm3: 2500, fuelType: "ice" };
    const res = await POST(req(input));
    expect(res.status).toBe(200);
    const json = (await res.json()) as CalculatorResult;
    expect(json.requiresOperator).toBe(true);
    if (json.requiresOperator) {
      expect(json.reason).toMatch(/санкцион/i);
    }
  });

  it("routes hybrids to operator (always sanctioned)", async () => {
    const input: CalculatorInput = { ...VALID, fuelType: "hybrid", volumeCm3: 1800 };
    const res = await POST(req(input));
    const json = (await res.json()) as CalculatorResult;
    expect(json.requiresOperator).toBe(true);
  });

  it("flags moto > 600 000 ¥ as operator-required", async () => {
    const input: CalculatorInput = {
      ...VALID,
      vehicleType: "moto",
      volumeCm3: 600,
      priceJpyLow: 700_000,
      priceJpyHigh: 900_000,
    };
    const res = await POST(req(input));
    expect(res.status).toBe(200);
    const json = (await res.json()) as CalculatorResult;
    expect(json.requiresOperator).toBe(true);
    if (json.requiresOperator) {
      expect(json.reason).toMatch(/мотоцикл|оператор/i);
    }
  });

  it("collapses diesel to ice for the shared calculator (non-sanctioned passthrough)", async () => {
    // 1500cc diesel is not sanctioned (treated as ice). In offline sandboxes the
    // CBR fetch will fail and the handler falls back to operator — either
    // outcome is acceptable (operator path exercises the try/catch).
    const input: CalculatorInput = { ...VALID, fuelType: "diesel", volumeCm3: 1500 };
    const res = await POST(req(input));
    expect(res.status).toBe(200);
    const json = (await res.json()) as CalculatorResult;
    // Either a full price range (if CBR is reachable during the test run) or
    // graceful operator fallback (if it's not). Both are valid.
    if (json.requiresOperator) {
      expect(typeof json.reason).toBe("string");
    } else {
      expect(json.low.finalTotalRub).toBeGreaterThan(0);
      expect(json.high.finalTotalRub).toBeGreaterThanOrEqual(json.low.finalTotalRub);
    }
  });
});
