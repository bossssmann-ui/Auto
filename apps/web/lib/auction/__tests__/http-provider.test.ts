/**
 * Tests for the production JSON-feed provider: happy path, error mapping
 * (upstream / validation), snapshot caching and stale-if-error fallback.
 * The feed format itself is shared with the fixtures, so catalog semantics
 * are covered by the mock-provider suite.
 */

import { describe, expect, it, vi } from "vitest";
import brandsFixture from "../fixtures/brands.json" with { type: "json" };
import lotsFixture from "../fixtures/lots.json" with { type: "json" };
import { AuctionProviderError } from "../provider";
import { HttpAuctionProvider } from "../providers/http";

type FetchImpl = typeof fetch;

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

/** fetch stub serving fixture data for /brands.json and /lots.json. */
function feedFetch(
  overrides: { brands?: unknown; lots?: unknown; status?: number } = {},
): FetchImpl {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (overrides.status && overrides.status >= 400) {
      return jsonResponse({}, overrides.status);
    }
    if (url.endsWith("/brands.json")) {
      return jsonResponse(overrides.brands ?? brandsFixture);
    }
    if (url.endsWith("/lots.json")) {
      return jsonResponse(overrides.lots ?? lotsFixture);
    }
    return jsonResponse({ error: "not found" }, 404);
  }) as unknown as FetchImpl;
}

const BASE = "https://feed.example.ru/catalog";

// No-op calculate so tests don't hit the CBR-backed turnkey calculator.
const calcStub = async () => ({
  success: false as const,
  requireHuman: true as const,
  message: "test stub",
});

function provider(fetchImpl: FetchImpl, ttlMs?: number) {
  return new HttpAuctionProvider({
    baseUrl: BASE,
    fetchImpl,
    ttlMs,
    calculate: calcStub,
  });
}

describe("HttpAuctionProvider — happy path", () => {
  it("lists brands from the remote feed", async () => {
    const p = provider(feedFetch());
    const brands = await p.listBrands();
    expect(brands.length).toBeGreaterThan(0);
    expect(brands[0]).toHaveProperty("slug");
    expect(brands[0]).toHaveProperty("modelCount");
  });

  it("searches lots and returns pagination metadata", async () => {
    const p = provider(feedFetch());
    const page = await p.searchLots({ page: 1, pageSize: 5 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.length).toBeLessThanOrEqual(5);
    expect(page.total).toBeGreaterThan(0);
  });

  it("returns a lot by id and null for unknown ids", async () => {
    const p = provider(feedFetch());
    const known = (lotsFixture as Array<{ lot_id: string }>)[0].lot_id;
    const lot = await p.getLot(known);
    expect(lot?.id).toBe(known);
    expect(await p.getLot("no-such-lot")).toBeNull();
  });

  it("streams lot ids and category paths for the sitemap", async () => {
    const p = provider(feedFetch());
    const ids: string[] = [];
    for await (const id of p.listAllLotIds()) ids.push(id);
    expect(ids.length).toBe((lotsFixture as unknown[]).length);

    const paths: unknown[] = [];
    for await (const path of p.listAllCategoryPaths()) paths.push(path);
    expect(paths.length).toBeGreaterThan(0);
  });
});

describe("HttpAuctionProvider — caching", () => {
  it("fetches the feed once for multiple calls within the TTL", async () => {
    const fetchImpl = feedFetch();
    const p = provider(fetchImpl);

    await p.listBrands();
    await p.searchLots({ page: 1, pageSize: 5 });
    await p.getLot("whatever");

    // One snapshot = two requests (brands + lots), not per method call.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("dedupes parallel snapshot loads", async () => {
    const fetchImpl = feedFetch();
    const p = provider(fetchImpl);

    await Promise.all([p.listBrands(), p.listBrands(), p.listBrands()]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the last good snapshot when a refresh fails", async () => {
    const good = feedFetch();
    const p = provider(good, 0 /* every call refreshes */);

    const first = await p.listBrands();
    expect(first.length).toBeGreaterThan(0);

    // Swap the fetch out from under the provider via prototype trickery is
    // not possible — instead use ttlMs=0 with a fetch that fails after the
    // first snapshot.
    let calls = 0;
    const flaky = vi.fn(async (input: RequestInfo | URL) => {
      calls += 1;
      if (calls > 2) throw new Error("feed down");
      const url = String(input);
      return url.endsWith("/brands.json")
        ? jsonResponse(brandsFixture)
        : jsonResponse(lotsFixture);
    }) as unknown as FetchImpl;

    const p2 = provider(flaky, 0);
    const ok = await p2.listBrands();
    expect(ok.length).toBeGreaterThan(0);
    const stale = await p2.listBrands(); // refresh fails → stale snapshot
    expect(stale).toEqual(ok);
  });
});

describe("HttpAuctionProvider — error mapping", () => {
  it("throws a clear upstream error on HTTP 5xx", async () => {
    const p = provider(feedFetch({ status: 503 }));
    await expect(p.listBrands()).rejects.toMatchObject({
      name: "AuctionProviderError",
      code: "upstream",
    });
  });

  it("throws an upstream error when the feed host is unreachable", async () => {
    const failing = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND feed.example.ru");
    }) as unknown as FetchImpl;
    const p = provider(failing);
    await expect(p.listBrands()).rejects.toMatchObject({ code: "upstream" });
  });

  it("throws a validation error when the feed fails the schema", async () => {
    const p = provider(feedFetch({ lots: [{ nonsense: true }] }));
    try {
      await p.searchLots({ page: 1, pageSize: 5 });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuctionProviderError);
      expect((err as AuctionProviderError).code).toBe("validation");
      expect((err as AuctionProviderError).message).toContain("lots.json");
    }
  });

  it("throws a validation error on a non-JSON body", async () => {
    const broken = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    })) as unknown as FetchImpl;
    const p = provider(broken);
    await expect(p.listBrands()).rejects.toMatchObject({ code: "validation" });
  });
});
