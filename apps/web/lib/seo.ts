/**
 * SEO / metadata helpers for the web app.
 *
 * Centralized here so pages and the `app/og` route read a single source of
 * truth for: canonical URL construction, organization schema, structured-data
 * builders (Organization, WebSite, BreadcrumbList, ItemList, Product+Offer).
 *
 * Only this module (and `lib/auction/client.ts`) is allowed to read
 * `process.env` — components must never do it.
 */

import type { LotDetail, LotListItem, PriceRangeRub } from "@/lib/auction";

/** Resolve site origin, stripping any trailing slash. */
export const SITE_URL: string = (() => {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    // Intentionally a visibly-broken placeholder so misconfigured prod
    // deploys fail loudly at SEO review (curl / Rich Results Test) instead
    // of silently shipping example.com URLs to search engines. Override
    // via NEXT_PUBLIC_SITE_URL=https://stm-import.ru (production domain).
    "https://set-site-url.invalid";
  return raw.replace(/\/+$/, "");
})();

/** Telegram bot username used for deep-links; read only here. */
export const TELEGRAM_BOT_USERNAME: string =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "spectechmash_bot";

/**
 * Confirmed public SpecTechMash profiles (source: PROJECT_PLAN.md §1).
 * VK / Telegram-channel are planned but NOT created yet — they must not
 * appear here or anywhere on the site until they exist.
 *
 * The Instagram profile exists and is listed in `sameAs` (machine-readable
 * identity), but is intentionally NOT rendered as a visible button: Meta is
 * designated extremist in RF and a visible link requires a legal disclaimer —
 * pending an explicit owner decision.
 */
export const SOCIAL_LINKS = {
  youtube: "https://www.youtube.com/@spectehmash",
  instagram: "https://www.instagram.com/spectehmash",
} as const;

/** Company identity — reused by JSON-LD and OG defaults. */
export const ORG = {
  name: "SpecTechMash",
  legalName: "ИП Хмелёв",
  description:
    "SpecTechMash (Спецтехмаш) — импорт авто, мототехники и спецтехники из Японии, Кореи и Китая с аукционов. Расчёт под ключ в рублях, доставка по всей России через Владивосток.",
  logoPath: "/favicon.ico",
  inLanguage: "ru-RU",
} as const;

/**
 * Build an absolute canonical URL from a path. The path must start with `/`.
 * Returns e.g. `https://site.tld/catalog/toyota`.
 */
export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized === "/" ? "" : normalized}`;
}

/** Build a URL to the dynamic OG image endpoint for a given context. */
export function ogImageUrl(params: {
  title: string;
  subtitle?: string;
  kind?: "lot" | "category" | "home" | "page";
}): string {
  const sp = new URLSearchParams();
  sp.set("title", params.title);
  if (params.subtitle) sp.set("subtitle", params.subtitle);
  sp.set("kind", params.kind ?? "page");
  return `${SITE_URL}/og?${sp.toString()}`;
}

// ---------------------------------------------------------------------------
// JSON-LD helpers
// ---------------------------------------------------------------------------

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORG.name,
    legalName: ORG.legalName,
    url: SITE_URL,
    logo: canonicalUrl(ORG.logoPath),
    description: ORG.description,
    sameAs: [
      // Telegram bot as a primary presence channel.
      `https://t.me/${TELEGRAM_BOT_USERNAME}`,
      SOCIAL_LINKS.youtube,
      SOCIAL_LINKS.instagram,
    ],
  };
}

/**
 * AutoDealer (a LocalBusiness subtype) — Yandex/Google local-business schema.
 *
 * Only verified facts are emitted: city Владивосток, areaServed RU, real
 * social profiles. Phone / registration ids are env-driven placeholders
 * (`NEXT_PUBLIC_CONTACT_PHONE`) and are omitted until configured — never
 * invented.
 */
export function autoDealerJsonLd(): JsonLd {
  const dealer: JsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: ORG.name,
    alternateName: "Спецтехмаш",
    legalName: ORG.legalName,
    url: SITE_URL,
    description: ORG.description,
    image: canonicalUrl(ORG.logoPath),
    areaServed: "RU",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Владивосток",
      addressCountry: "RU",
    },
    priceRange: "₽₽",
    sameAs: [
      `https://t.me/${TELEGRAM_BOT_USERNAME}`,
      SOCIAL_LINKS.youtube,
      SOCIAL_LINKS.instagram,
    ],
  };

  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE;
  if (phone) dealer.telephone = phone;

  return dealer;
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ORG.name,
    url: SITE_URL,
    inLanguage: ORG.inLanguage,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/catalog?brand={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** FAQPage schema for pages with a visible FAQ block. */
export function faqJsonLd(items: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export interface BreadcrumbItem {
  /** Visible label. */
  name: string;
  /** Absolute or root-relative URL. Converted to absolute in the output. */
  url: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : canonicalUrl(item.url),
    })),
  };
}

export function itemListJsonLd(
  name: string,
  items: Array<{ name: string; url: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url.startsWith("http") ? item.url : canonicalUrl(item.url),
    })),
  };
}

/**
 * Midpoint of a RUB price range, rounded to the nearest thousand rubles.
 *
 * Schema.org's `Offer.price` is a single scalar — we can't emit both ends of
 * our ±10 % under-key range. We pick the midpoint and round to 1 000 ₽ so
 * the number reads naturally in rich results and doesn't imply precision we
 * don't have. The real range is still exposed via `priceSpecification`.
 */
function midRub(range: PriceRangeRub): number {
  return Math.round((range.low + range.high) / 2 / 1000) * 1000;
}

/**
 * Build Product + Offer JSON-LD for a lot.
 *
 * When `requiresOperator` is true the lot has no concrete price, so we emit a
 * PreOrder offer without `price` — Google accepts this per the Product
 * structured-data spec and it matches our UI (operator card).
 */
export function productJsonLd(lot: LotDetail | LotListItem, url: string): JsonLd {
  const absoluteUrl = url.startsWith("http") ? url : canonicalUrl(url);

  const offer: JsonLd = lot.priceRangeRub
    ? {
        "@type": "Offer",
        url: absoluteUrl,
        priceCurrency: "RUB",
        price: midRub(lot.priceRangeRub),
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "RUB",
          minPrice: lot.priceRangeRub.low,
          maxPrice: lot.priceRangeRub.high,
        },
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/UsedCondition",
      }
    : {
        "@type": "Offer",
        url: absoluteUrl,
        priceCurrency: "RUB",
        availability: "https://schema.org/PreOrder",
        itemCondition: "https://schema.org/UsedCondition",
      };

  const photos =
    "photos" in lot && Array.isArray(lot.photos) ? lot.photos : [];
  const thumb = lot.thumbnail ? [lot.thumbnail] : [];
  const images = (photos.length > 0 ? photos : thumb).map((p) =>
    p.startsWith("http") ? p : canonicalUrl(p),
  );

  const product: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: lot.title,
    description: lot.title,
    brand: {
      "@type": "Brand",
      name: lot.brandSlug,
    },
    model: lot.modelSlug,
    productionDate: String(lot.year),
    sku: lot.id,
    offers: offer,
  };

  if (images.length > 0) product.image = images;
  if (lot.mileageKm !== null && lot.mileageKm !== undefined) {
    product.mileageFromOdometer = {
      "@type": "QuantitativeValue",
      value: lot.mileageKm,
      unitCode: "KMT",
    };
  }

  return product;
}
