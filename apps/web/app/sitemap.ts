import type { MetadataRoute } from "next";
import { listAllCategoryPaths, listAllLotIds } from "@/lib/auction";
import { SITE_URL } from "@/lib/seo";

const BASE_URL = SITE_URL;

const STATIC_PATHS = [
  "",
  "/catalog",
  "/calculator",
  "/about",
  "/contacts",
  "/import-auto-japan",
  "/import-special-machinery",
  "/delivery",
  "/customs",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${BASE_URL}${p}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
  }));

  for await (const path of listAllCategoryPaths()) {
    const parts = ["/catalog", path.brand];
    if (path.model) parts.push(path.model);
    if (path.generation) parts.push(path.generation);
    entries.push({
      url: `${BASE_URL}${parts.join("/")}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  for await (const id of listAllLotIds()) {
    entries.push({
      url: `${BASE_URL}/lot/${id}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    });
  }

  return entries;
}
