import Link from "next/link";
import { env } from "@/config/env";
import { CatalogPriceControls } from "@/features/catalog/components/catalog-price-controls";
import {
  CatalogPageState,
  CatalogSortBy,
  buildCatalogQueryString
} from "@/features/catalog/lib/catalog-query";

type CatalogFilterPanelProps = {
  state: CatalogPageState;
  basePath: string;
  heading: string;
  categories: Array<{ slug: string; name: string }>;
  lockedBrand?: string;
};

const sortOptions: Array<{ value: CatalogSortBy; label: string }> = [
  { value: "newest", label: "Сначала новые" },
  { value: "price_asc", label: "Цена: по возрастанию" },
  { value: "price_desc", label: "Цена: по убыванию" },
  { value: "name_asc", label: "Название: A-Z" }
];

const pageSizeOptions = [12, 24, 36] as const;
const USD_PRICE_PRESETS: Array<{ minPrice?: number; maxPrice?: number }> = [
  { maxPrice: 100 },
  { minPrice: 100, maxPrice: 300 },
  { minPrice: 300, maxPrice: 700 },
  { minPrice: 700, maxPrice: 1500 },
  { minPrice: 1500 }
];

const rubShortFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0
});

const buildHref = (pathname: string, queryString: string): string =>
  queryString.length > 0 ? `${pathname}?${queryString}` : pathname;

const toRub = (usd: number): number => Math.round(usd * env.STORE_USD_TO_RUB_RATE);

const RUB_PRICE_RANGE = {
  floor: 0,
  ceiling: toRub(5000)
} as const;

const formatPresetValue = (value: number): string => `${rubShortFormatter.format(value)} ₽`;

const formatPresetLabel = (minPrice: number | undefined, maxPrice: number | undefined): string => {
  if (minPrice !== undefined && maxPrice !== undefined) {
    return `${formatPresetValue(minPrice)}-${formatPresetValue(maxPrice)}`;
  }

  if (maxPrice !== undefined) {
    return `До ${formatPresetValue(maxPrice)}`;
  }

  if (minPrice !== undefined) {
    return `От ${formatPresetValue(minPrice)}`;
  }

  return "Все цены";
};

export const CatalogFilterPanel = ({
  state,
  basePath,
  heading,
  categories,
  lockedBrand
}: CatalogFilterPanelProps): JSX.Element => {
  const resetQuery = buildCatalogQueryString(
    {
      ...state,
      page: 1,
      search: undefined,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sortBy: "newest"
    },
    {
      pageSize: state.pageSize
    },
    { omitBrand: Boolean(lockedBrand) }
  );

  const openByDefault =
    !state.search && !state.category && state.minPrice === undefined && state.maxPrice === undefined;

  const pricePresets = USD_PRICE_PRESETS.map((preset) => {
    const minPrice = preset.minPrice === undefined ? undefined : toRub(preset.minPrice);
    const maxPrice = preset.maxPrice === undefined ? undefined : toRub(preset.maxPrice);

    return {
      minPrice,
      maxPrice,
      label: formatPresetLabel(minPrice, maxPrice)
    };
  });

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <details className="group" open={openByDefault}>
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition hover:border-primary hover:text-primary">
          <span>{heading}</span>
          <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground group-open:hidden">Показать</span>
          <span className="hidden text-xs uppercase tracking-[0.12em] text-muted-foreground group-open:inline">Скрыть</span>
        </summary>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {lockedBrand ? (
              <span className="rounded-md border bg-muted/40 px-2 py-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Бренд: {lockedBrand}
              </span>
            ) : (
              <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Общие фильтры каталога</span>
            )}
            <Link
              href={buildHref(basePath, resetQuery)}
              className="rounded-md border px-3 py-1 text-xs uppercase tracking-[0.12em] transition hover:border-primary hover:text-primary"
            >
              Сбросить фильтры
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {pricePresets.map((preset) => {
              const query = buildCatalogQueryString(
                {
                  ...state,
                  page: 1
                },
                {
                  minPrice: preset.minPrice,
                  maxPrice: preset.maxPrice
                },
                { omitBrand: Boolean(lockedBrand) }
              );
              const isActive = state.minPrice === preset.minPrice && state.maxPrice === preset.maxPrice;

              return (
                <Link
                  key={preset.label}
                  href={buildHref(basePath, query)}
                  className={`rounded-full border px-3 py-1 text-xs tracking-wide transition hover:border-primary hover:text-primary ${
                    isActive ? "border-primary text-primary" : ""
                  }`}
                >
                  {preset.label}
                </Link>
              );
            })}
          </div>

          <form action={basePath} method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Поиск
              <input
                type="search"
                name="search"
                defaultValue={state.search ?? ""}
                placeholder="Модель, материал, теги"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>

            <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Категория
              <select
                name="category"
                defaultValue={state.category ?? ""}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Все категории</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <CatalogPriceControls
              initialMinPrice={state.minPrice}
              initialMaxPrice={state.maxPrice}
              floor={RUB_PRICE_RANGE.floor}
              ceiling={RUB_PRICE_RANGE.ceiling}
            />

            <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Сортировка
              <select
                name="sortBy"
                defaultValue={state.sortBy}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              На страницу
              <select
                name="pageSize"
                defaultValue={String(state.pageSize)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <input type="hidden" name="page" value="1" />

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Применить
              </button>
            </div>
          </form>
        </div>
      </details>
    </section>
  );
};
