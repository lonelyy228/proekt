import { CUSTOMIZER_BASE_BRANDS } from "@/config/customizer";

export const CATALOG_BRANDED_BRANDS = [
  "ADIDAS",
  "NIKE",
  "PUMA",
  "TIMBERLAND",
  "MAISON MARGIELA",
  "GUCCI",
  "BALENCIAGA",
  "OFF-WHITE",
  "STONE ISLAND",
  "NEW BALANCE"
] as const;

export const CATALOG_BASE_BRANDS = [...CUSTOMIZER_BASE_BRANDS] as const;

export const CATALOG_BRANDS = [...CATALOG_BASE_BRANDS, ...CATALOG_BRANDED_BRANDS] as const;

const compactWhitespace = (value: string): string => value.trim().replace(/\s+/g, " ");

export const normalizeBrandName = (value: string): string => compactWhitespace(value).toUpperCase();

export const brandToSlug = (brand: string): string =>
  normalizeBrandName(brand)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

export const brandFromSlug = (slug: string): string => {
  const normalizedSlug = slug.trim().toLowerCase();
  const known = CATALOG_BRANDS.find((brand) => brandToSlug(brand) === normalizedSlug);

  if (known) {
    return known;
  }

  return normalizeBrandName(slug.replace(/-/g, " "));
};
