import { describe, it, expect } from "vitest";
import {
  canonicalUrl,
  breadcrumbJsonLd,
  itemListJsonLd,
  organizationJsonLd,
  websiteJsonLd,
  productJsonLd,
  ogImageUrl,
  SITE_URL,
} from "@/lib/seo";
import type { LotDetail, LotListItem } from "@/lib/auction";

const validLot: LotListItem = {
  id: "lot-1",
  slug: "toyota-harrier-xu80-2023",
  brandSlug: "toyota",
  modelSlug: "harrier",
  generationSlug: "xu80",
  title: "Toyota Harrier Z 2.5 Hybrid",
  year: 2023,
  mileageKm: 18000,
  auctionGrade: 4.5,
  volumeCm3: 2500,
  fuelType: "hybrid",
  bodyType: "suv",
  auctionPriceJpy: 3_500_000,
  thumbnail: "/lot-placeholder.svg",
  priceRangeRub: { low: 4_000_000, high: 4_800_000 },
  requiresOperator: false,
  operatorReason: null,
};

const flaggedLot: LotListItem = {
  ...validLot,
  id: "lot-2",
  priceRangeRub: null,
  requiresOperator: true,
  operatorReason: "Требуется проверка оператора",
};

describe("canonicalUrl", () => {
  it("absolutizes a leading-slash path", () => {
    expect(canonicalUrl("/catalog/toyota")).toBe(`${SITE_URL}/catalog/toyota`);
  });

  it("prefixes a missing leading slash", () => {
    expect(canonicalUrl("catalog/honda")).toBe(`${SITE_URL}/catalog/honda`);
  });

  it("returns the bare origin for '/'", () => {
    expect(canonicalUrl("/")).toBe(SITE_URL);
  });
});

describe("organizationJsonLd / websiteJsonLd", () => {
  it("organization has @type Organization with a URL", () => {
    const org = organizationJsonLd();
    expect(org["@type"]).toBe("Organization");
    expect(org.url).toBe(SITE_URL);
    expect(org.name).toBeTruthy();
  });

  it("website declares a SearchAction", () => {
    const site = websiteJsonLd();
    expect(site["@type"]).toBe("WebSite");
    const action = site.potentialAction as { "@type": string };
    expect(action["@type"]).toBe("SearchAction");
  });
});

describe("breadcrumbJsonLd", () => {
  it("emits BreadcrumbList with 1-indexed positions and absolute URLs", () => {
    const bc = breadcrumbJsonLd([
      { name: "Главная", url: "/" },
      { name: "Каталог", url: "/catalog" },
      { name: "Toyota", url: "/catalog/toyota" },
    ]);
    expect(bc["@type"]).toBe("BreadcrumbList");
    const items = bc.itemListElement as Array<{
      position: number;
      name: string;
      item: string;
    }>;
    expect(items).toHaveLength(3);
    expect(items[0].position).toBe(1);
    expect(items[2].position).toBe(3);
    expect(items[2].item.startsWith(SITE_URL)).toBe(true);
    expect(items[2].item).toContain("/catalog/toyota");
  });

  it("preserves already-absolute URLs", () => {
    const bc = breadcrumbJsonLd([
      { name: "External", url: "https://example.org/x" },
    ]);
    const items = bc.itemListElement as Array<{ item: string }>;
    expect(items[0].item).toBe("https://example.org/x");
  });
});

describe("itemListJsonLd", () => {
  it("emits ItemList with numberOfItems matching input length", () => {
    const list = itemListJsonLd("Models", [
      { name: "Harrier", url: "/catalog/toyota/harrier" },
      { name: "Camry", url: "/catalog/toyota/camry" },
    ]);
    expect(list["@type"]).toBe("ItemList");
    expect(list.numberOfItems).toBe(2);
    expect((list.itemListElement as unknown[]).length).toBe(2);
  });
});

describe("productJsonLd — valid lot", () => {
  it("emits Product with Offer priced in RUB", () => {
    const ld = productJsonLd(validLot, "/lot/lot-1");
    expect(ld["@type"]).toBe("Product");
    expect(ld.sku).toBe("lot-1");
    const offer = ld.offers as Record<string, unknown>;
    expect(offer["@type"]).toBe("Offer");
    expect(offer.priceCurrency).toBe("RUB");
    expect(typeof offer.price).toBe("number");
    expect(offer.availability).toBe("https://schema.org/InStock");
    // URL must be absolute.
    expect(String(offer.url).startsWith(SITE_URL)).toBe(true);
  });

  it("includes mileage as QuantitativeValue in kilometers", () => {
    const ld = productJsonLd(validLot, "/lot/lot-1");
    const mileage = ld.mileageFromOdometer as {
      "@type": string;
      value: number;
      unitCode: string;
    };
    expect(mileage["@type"]).toBe("QuantitativeValue");
    expect(mileage.value).toBe(18000);
    expect(mileage.unitCode).toBe("KMT");
  });
});

describe("productJsonLd — requiresOperator lot", () => {
  it("omits price and uses PreOrder availability when priceRangeRub is null", () => {
    const ld = productJsonLd(flaggedLot, "/lot/lot-2");
    const offer = ld.offers as Record<string, unknown>;
    expect(offer.priceCurrency).toBe("RUB");
    expect(offer.price).toBeUndefined();
    expect(offer.priceSpecification).toBeUndefined();
    expect(offer.availability).toBe("https://schema.org/PreOrder");
  });
});

describe("productJsonLd — lot detail with photos", () => {
  it("surfaces the photo array as image[]", () => {
    const detail: LotDetail = {
      ...validLot,
      auction: "USS Tokyo",
      auctionDate: "2025-03-01",
      color: "White",
      transmission: "cvt",
      drive: "awd",
      trim: "Z Leather",
      photos: ["/lot-placeholder.svg", "/lot-placeholder.svg"],
    };
    const ld = productJsonLd(detail, "/lot/lot-1");
    const images = ld.image as string[];
    expect(Array.isArray(images)).toBe(true);
    expect(images).toHaveLength(2);
    expect(images[0].startsWith(SITE_URL)).toBe(true);
  });
});

describe("ogImageUrl", () => {
  it("builds a /og URL with title, subtitle, kind", () => {
    const url = ogImageUrl({
      title: "Toyota Harrier",
      subtitle: "2023",
      kind: "lot",
    });
    expect(url.startsWith(`${SITE_URL}/og?`)).toBe(true);
    expect(url).toContain("title=Toyota+Harrier");
    expect(url).toContain("kind=lot");
  });

  it("defaults kind to 'page' when omitted", () => {
    const url = ogImageUrl({ title: "Contacts" });
    expect(url).toContain("kind=page");
  });
});
