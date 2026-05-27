const normalizeBrand = (brand: string): string => brand.trim().replace(/\s+/g, " ").toUpperCase();

export const CUSTOMIZER_BASE_BRANDS = ["RSH BASICS"] as const;

const baseBrandSet = new Set<string>(CUSTOMIZER_BASE_BRANDS.map(normalizeBrand));

export const isCustomizerBaseBrand = (brand: string): boolean => baseBrandSet.has(normalizeBrand(brand));

export const CUSTOMIZER_BRAND_RESTRICTION_MESSAGE =
  "Кастомизация доступна только для базовой линейки RSH BASICS. Брендовые товары продаются без изменения дизайна.";
