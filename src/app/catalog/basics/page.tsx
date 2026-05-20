import { CatalogScreen } from "@/features/catalog/components/catalog-screen";
import { parseCatalogPageState, toCatalogServiceParams } from "@/features/catalog/lib/catalog-query";
import { productService } from "@/server/services/product-service";
import { CUSTOMIZER_BASE_BRANDS } from "@/config/customizer";

export const dynamic = "force-dynamic";

export default async function BasicsCatalogPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const state = parseCatalogPageState(searchParams, CUSTOMIZER_BASE_BRANDS[0]);

  const [catalog, categories] = await Promise.all([
    productService.listCatalog({
      ...toCatalogServiceParams(state),
      scope: "BASICS"
    }),
    productService.listCategories("BASICS")
  ]);

  return (
    <CatalogScreen
      title="RSH Basics"
      subtitle="Отдельная линия blank-вещей для 2D кастомизации: футболки, худи, свитшоты, шорты и штаны."
      state={state}
      basePath="/catalog/basics"
      categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
      items={catalog.items}
      total={catalog.total}
      totalPages={catalog.totalPages}
      lockedBrand={CUSTOMIZER_BASE_BRANDS[0]}
    />
  );
}
