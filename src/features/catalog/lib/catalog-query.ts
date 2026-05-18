import { env } from "@/config/env";
import { paginationConfig } from "@/config/constants";

export type CatalogSortBy = "newest" | "price_asc" | "price_desc" | "name_asc";

export type CatalogPageState = {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy: CatalogSortBy;
  page: number;
  pageSize: number;
};

const ALLOWED_SORT: CatalogSortBy[] = ["newest", "price_asc", "price_desc", "name_asc"];

const readSingleValue = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
};

const normalizeText = (value: string | undefined, maxLength: number): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.slice(0, maxLength);
};

const parsePositiveInt = (value: string | undefined, fallback: number, maxValue: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), maxValue);
};

const parseRubPrice = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return Math.round(parsed);
};

const usdCentsToRub = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  const usdAmount = Math.round(parsed) / 100;
  return Math.round(usdAmount * env.STORE_USD_TO_RUB_RATE);
};

const rubPriceToUsdCents = (priceRub: number): number => {
  const usdAmount = priceRub / env.STORE_USD_TO_RUB_RATE;
  return Math.max(0, Math.round(usdAmount * 100));
};

export const parseCatalogPageState = (
  searchParams: Record<string, string | string[] | undefined>,
  forcedBrand?: string
): CatalogPageState => {
  const search = normalizeText(readSingleValue(searchParams.search), 120);
  const category = normalizeText(readSingleValue(searchParams.category), 80);
  const brand = forcedBrand ?? normalizeText(readSingleValue(searchParams.brand), 80);

  const minPriceFromQuery = parseRubPrice(readSingleValue(searchParams.minPrice));
  const maxPriceFromQuery = parseRubPrice(readSingleValue(searchParams.maxPrice));

  const minPriceLegacy = usdCentsToRub(readSingleValue(searchParams.minPriceCents));
  const maxPriceLegacy = usdCentsToRub(readSingleValue(searchParams.maxPriceCents));

  let minPrice = minPriceFromQuery ?? minPriceLegacy;
  let maxPrice = maxPriceFromQuery ?? maxPriceLegacy;

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    const swap = minPrice;
    minPrice = maxPrice;
    maxPrice = swap;
  }

  const sortRaw = readSingleValue(searchParams.sortBy);
  const sortBy = ALLOWED_SORT.includes(sortRaw as CatalogSortBy) ? (sortRaw as CatalogSortBy) : "newest";

  const page = parsePositiveInt(
    readSingleValue(searchParams.page),
    paginationConfig.defaultPage,
    Number.MAX_SAFE_INTEGER
  );
  const pageSize = parsePositiveInt(
    readSingleValue(searchParams.pageSize),
    paginationConfig.defaultPageSize,
    paginationConfig.maxPageSize
  );

  return {
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    sortBy,
    page,
    pageSize
  };
};

export const toCatalogServiceParams = (state: CatalogPageState): {
  search?: string;
  category?: string;
  brand?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sortBy: CatalogSortBy;
  page: number;
  pageSize: number;
  skip: number;
} => {
  const minPriceCents = state.minPrice !== undefined ? rubPriceToUsdCents(state.minPrice) : undefined;
  const maxPriceCents = state.maxPrice !== undefined ? rubPriceToUsdCents(state.maxPrice) : undefined;

  return {
    search: state.search,
    category: state.category,
    brand: state.brand,
    minPriceCents,
    maxPriceCents,
    sortBy: state.sortBy,
    page: state.page,
    pageSize: state.pageSize,
    skip: (state.page - 1) * state.pageSize
  };
};

export const buildCatalogQueryString = (
  state: CatalogPageState,
  overrides: Partial<CatalogPageState> = {},
  options?: { omitBrand?: boolean }
): string => {
  const next: CatalogPageState = {
    ...state,
    ...overrides
  };

  const params = new URLSearchParams();

  if (next.search) {
    params.set("search", next.search);
  }

  if (next.category) {
    params.set("category", next.category);
  }

  if (!options?.omitBrand && next.brand) {
    params.set("brand", next.brand);
  }

  if (next.minPrice !== undefined) {
    params.set("minPrice", String(next.minPrice));
  }

  if (next.maxPrice !== undefined) {
    params.set("maxPrice", String(next.maxPrice));
  }

  if (next.sortBy !== "newest") {
    params.set("sortBy", next.sortBy);
  }

  if (next.page !== paginationConfig.defaultPage) {
    params.set("page", String(next.page));
  }

  if (next.pageSize !== paginationConfig.defaultPageSize) {
    params.set("pageSize", String(next.pageSize));
  }

  return params.toString();
};
