import { CatalogScreen } from "@/features/catalog/components/catalog-screen";
import { parseCatalogPageState, toCatalogServiceParams } from "@/features/catalog/lib/catalog-query";
import { productService } from "@/server/services/product-service";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const state = parseCatalogPageState(searchParams);

  const [catalog, categories] = await Promise.all([
    productService.listCatalog(toCatalogServiceParams(state)),
    productService.listCategories()
  ]);

  return (
    <CatalogScreen
      title="Брендовые Вещи"
      subtitle="Подборка RSH: премиальные позиции, архивные силуэты и редкие дропы."
      state={state}
      basePath="/catalog"
      categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
      items={catalog.items}
      total={catalog.total}
      totalPages={catalog.totalPages}
    />
  );
}
