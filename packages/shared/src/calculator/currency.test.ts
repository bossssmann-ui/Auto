/**
 * Tests for the CBR rates cache layer: TTL caching, in-flight dedupe,
 * timeout-driven failure and stale-if-error fallback. Calculation formulas
 * are covered separately by the golden tests in `calculator.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CBR_CACHE_TTL_MS,
  __resetCbrRatesCache,
  fetchCbrRates,
} from './currency';

const FAKE_CBR_JSON = {
  Valute: {
    JPY: { Value: 0.65, Nominal: 1 },
    USD: { Value: 95.0, Nominal: 1 },
    EUR: { Value: 103.0, Nominal: 1 },
  },
};

function okResponse(json: unknown = FAKE_CBR_JSON): Response {
  return { ok: true, json: async () => json } as unknown as Response;
}

beforeEach(() => {
  __resetCbrRatesCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchCbrRates cache', () => {
  it('parses CBR payload into per-unit rates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse()));
    const rates = await fetchCbrRates();
    expect(rates).toEqual({ JPY_CBR: 0.65, USD_CBR: 95.0, EUR_CBR: 103.0 });
  });

  it('serves the second sequential call from cache (single HTTP request)', async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await fetchCbrRates();
    await fetchCbrRates();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('dedupes parallel calls into one in-flight request', async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    const [a, b] = await Promise.all([fetchCbrRates(), fetchCbrRates()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('refetches after the TTL expires', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await fetchCbrRates();
    vi.advanceTimersByTime(CBR_CACHE_TTL_MS + 1);
    await fetchCbrRates();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to stale cache when a refresh fails', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(okResponse())
      .mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', fetchSpy);

    const fresh = await fetchCbrRates();
    vi.advanceTimersByTime(CBR_CACHE_TTL_MS + 1);
    const stale = await fetchCbrRates();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(stale).toEqual(fresh);
  });

  it('throws when the fetch fails and no cache exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('timeout')),
    );
    await expect(fetchCbrRates()).rejects.toThrow('timeout');
  });

  it('throws on a non-OK CBR response without caching it', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 } as unknown as Response)
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await expect(fetchCbrRates()).rejects.toThrow('CBR API error: 503');
    const rates = await fetchCbrRates();
    expect(rates.USD_CBR).toBe(95.0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
