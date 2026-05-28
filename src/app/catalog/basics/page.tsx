import { CatalogScreen } from "@/features/catalog/components/catalog-screen";
import { parseCatalogPageState, toCatalogServiceParams } from "@/features/catalog/lib/catalog-query";
import { productService } from "@/server/services/product-service";

const BASICS_BRAND = "RSH BASICS";

export const dynamic = "force-dynamic";

export default async function BasicsCatalogPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const state = parseCatalogPageState(searchParams, BASICS_BRAND);

  const [catalog, categories] = await Promise.all([
    productService.listCatalog(toCatalogServiceParams(state)),
    productService.listCategories()
  ]);

  return (
    <CatalogScreen
      title="RSH Basics для кастомизации"
      subtitle="Базовые вещи RSH BASICS: эти позиции можно персонализировать в 2D Lab. Брендовые товары кастомизации не подлежат."
      state={state}
      basePath="/catalog/basics"
      categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
      items={catalog.items}
      total={catalog.total}
      totalPages={catalog.totalPages}
      lockedBrand={BASICS_BRAND}
    />
  );
}
