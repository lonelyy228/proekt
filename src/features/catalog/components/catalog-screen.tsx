import { CatalogBrandRail } from "@/features/catalog/components/catalog-brand-rail";
import { CatalogFilterPanel } from "@/features/catalog/components/catalog-filter-panel";
import { CatalogPagination } from "@/features/catalog/components/catalog-pagination";
import { ProductGrid } from "@/features/catalog/components/product-grid";
import { CatalogPageState } from "@/features/catalog/lib/catalog-query";
import { ProductListItem } from "@/types/domain";

type CatalogScreenProps = {
  title: string;
  subtitle: string;
  state: CatalogPageState;
  basePath: string;
  categories: Array<{ slug: string; name: string }>;
  items: ProductListItem[];
  total: number;
  totalPages: number;
  lockedBrand?: string;
};

export const CatalogScreen = ({
  title,
  subtitle,
  state,
  basePath,
  categories,
  items,
  total,
  totalPages,
  lockedBrand
}: CatalogScreenProps): JSX.Element => (
  <div className="space-y-6">
    <div>
      <p className="text-xs uppercase tracking-[0.24em] text-primary">RSH Каталог</p>
      <h1 className="text-5xl tracking-[0.06em]" style={{ fontFamily: "var(--font-heading)" }}>
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
    </div>

    {!lockedBrand ? <CatalogBrandRail state={state} /> : null}

    <CatalogFilterPanel
      state={state}
      basePath={basePath}
      heading="Фильтры"
      categories={categories}
      lockedBrand={lockedBrand}
    />

    {items.length > 0 ? (
      <ProductGrid products={items} />
    ) : (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        По выбранным фильтрам ничего не найдено. Измените диапазон цены или сбросьте часть условий.
      </div>
    )}

    <CatalogPagination
      basePath={basePath}
      state={state}
      totalPages={totalPages}
      total={total}
      omitBrandInQuery={Boolean(lockedBrand)}
    />
  </div>
);
