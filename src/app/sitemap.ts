import type { MetadataRoute } from "next";
import { ProductStatus } from "@prisma/client";
import { env } from "@/config/env";
import { CATALOG_BRANDS, brandToSlug } from "@/features/catalog/brand-directory";
import { prisma } from "@/lib/prisma";

const staticRoutes = [
  "",
  "/catalog",
  "/catalog/basics",
  "/editor",
  "/delivery",
  "/returns",
  "/contacts",
  "/privacy",
  "/terms",
  "/offer",
  "/login",
  "/register"
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = new URL(env.APP_URL);

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      deletedAt: null
    },
    select: {
      slug: true,
      updatedAt: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: new URL(route || "/", baseUrl).toString(),
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.startsWith("/catalog") ? 0.9 : 0.7
  }));

  const brandEntries: MetadataRoute.Sitemap = CATALOG_BRANDS.map((brand) => ({
    url: new URL(`/catalog/brands/${brandToSlug(brand)}`, baseUrl).toString(),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: new URL(`/product/${product.slug}`, baseUrl).toString(),
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8
  }));

  return [...staticEntries, ...brandEntries, ...productEntries];
}
