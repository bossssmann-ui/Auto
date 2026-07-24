import { describe, expect, it } from "vitest";
import { GEO_CITIES, getCity } from "@/lib/geo/cities";

describe("GEO_CITIES data contract", () => {
  it("starts with ~30 major cities", () => {
    expect(GEO_CITIES.length).toBeGreaterThanOrEqual(30);
  });

  it("has unique kebab-case slugs", () => {
    const slugs = GEO_CITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("every city has complete display fields", () => {
    for (const city of GEO_CITIES) {
      expect(city.name.length).toBeGreaterThan(0);
      expect(city.namePrepositional).toMatch(/^(в|во) /);
      expect(city.region.length).toBeGreaterThan(0);
      expect(city.federalDistrict).toContain("ФО");
      expect(city.deliveryDaysEstimate).toMatch(/^\d+–\d+$/);
      expect(city.deliveryPriceFromRub).toBeGreaterThanOrEqual(0);
    }
  });

  it("only Vladivostok is the zero-price pickup point", () => {
    const pickup = GEO_CITIES.filter((c) => c.deliveryPriceFromRub === 0);
    expect(pickup.map((c) => c.slug)).toEqual(["vladivostok"]);
  });

  it("getCity resolves slugs and rejects unknowns", () => {
    expect(getCity("moskva")?.name).toBe("Москва");
    expect(getCity("no-such-city")).toBeUndefined();
  });
});
