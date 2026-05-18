import Link from "next/link";
import { CatalogPageState, buildCatalogQueryString } from "@/features/catalog/lib/catalog-query";

type CatalogPaginationProps = {
  basePath: string;
  state: CatalogPageState;
  totalPages: number;
  total: number;
  omitBrandInQuery?: boolean;
};

const buildHref = (pathname: string, queryString: string): string => (queryString.length > 0 ? `${pathname}?${queryString}` : pathname);

export const CatalogPagination = ({
  basePath,
  state,
  totalPages,
  total,
  omitBrandInQuery
}: CatalogPaginationProps): JSX.Element => {
  const canPrev = state.page > 1;
  const canNext = state.page < totalPages;

  const prevQuery = buildCatalogQueryString(
    state,
    {
      page: Math.max(1, state.page - 1)
    },
    { omitBrand: omitBrandInQuery }
  );

  const nextQuery = buildCatalogQueryString(
    state,
    {
      page: Math.min(totalPages, state.page + 1)
    },
    { omitBrand: omitBrandInQuery }
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Страница {state.page} из {totalPages} ({total} позиций)
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={buildHref(basePath, prevQuery)}
          aria-disabled={!canPrev}
          className={`rounded-md border px-3 py-1.5 text-sm transition ${
            canPrev ? "hover:border-primary hover:text-primary" : "pointer-events-none opacity-40"
          }`}
        >
          Назад
        </Link>
        <Link
          href={buildHref(basePath, nextQuery)}
          aria-disabled={!canNext}
          className={`rounded-md border px-3 py-1.5 text-sm transition ${
            canNext ? "hover:border-primary hover:text-primary" : "pointer-events-none opacity-40"
          }`}
        >
          Вперед
        </Link>
      </div>
    </div>
  );
};
