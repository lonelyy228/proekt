import Link from "next/link";
import { CATALOG_BRANDED_BRANDS, brandToSlug } from "@/features/catalog/brand-directory";
import { CatalogPageState, buildCatalogQueryString } from "@/features/catalog/lib/catalog-query";

type CatalogBrandRailProps = {
  state: CatalogPageState;
};

const buildHref = (pathname: string, queryString: string): string => (queryString.length > 0 ? `${pathname}?${queryString}` : pathname);

export const CatalogBrandRail = ({ state }: CatalogBrandRailProps): JSX.Element => (
  <section className="space-y-2 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Бренды</h2>
      <Link
        href={buildHref("/catalog", buildCatalogQueryString({ ...state, brand: undefined, page: 1 }, {}, { omitBrand: true }))}
        className="rounded-md border px-2 py-1 text-[11px] uppercase tracking-[0.1em] transition hover:border-primary hover:text-primary"
      >
        Все бренды
      </Link>
    </div>

    <div className="flex flex-wrap gap-2">
      <Link
        href={buildHref("/catalog/basics", buildCatalogQueryString({ ...state, brand: undefined, page: 1 }, {}, { omitBrand: true }))}
        className="rounded-full border border-primary px-3 py-1 text-xs tracking-wide text-primary transition hover:bg-primary/5"
      >
        RSH Basics
      </Link>

      {CATALOG_BRANDED_BRANDS.map((brand) => {
        const brandPath = `/catalog/brands/${brandToSlug(brand)}`;
        const queryWithoutBrand = buildCatalogQueryString(
          {
            ...state,
            brand,
            page: 1
          },
          {},
          { omitBrand: true }
        );

        return (
          <Link
            key={brand}
            href={buildHref(brandPath, queryWithoutBrand)}
            className={`rounded-full border px-3 py-1 text-xs tracking-wide transition hover:border-primary hover:text-primary ${
              state.brand === brand ? "border-primary bg-primary/5 text-primary" : ""
            }`}
          >
            {brand}
          </Link>
        );
      })}
    </div>
  </section>
);
