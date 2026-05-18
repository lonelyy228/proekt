import { revalidateTag } from "next/cache";

export const CACHE_TAGS = {
  catalog: "catalog",
  product: (slug: string) => `product:${slug}`
} as const;

export const invalidateCatalogCache = (): void => {
  revalidateTag(CACHE_TAGS.catalog);
};

export const invalidateProductCache = (slug: string): void => {
  revalidateTag(CACHE_TAGS.product(slug));
};
