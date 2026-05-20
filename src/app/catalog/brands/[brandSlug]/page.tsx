import { CatalogScreen } from "@/features/catalog/components/catalog-screen";
import { brandFromSlug } from "@/features/catalog/brand-directory";
import { parseCatalogPageState, toCatalogServiceParams } from "@/features/catalog/lib/catalog-query";
import { productService } from "@/server/services/product-service";
import { isCustomizerBaseBrand } from "@/config/customizer";

export const dynamic = "force-dynamic";

export default async function BrandCatalogPage({
  params,
  searchParams
}: {
  params: { brandSlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const brand = brandFromSlug(params.brandSlug);
  const state = parseCatalogPageState(searchParams, brand);
  const scope = isCustomizerBaseBrand(brand) ? "BASICS" : "BRANDED";

  const [catalog, categories] = await Promise.all([
    productService.listCatalog({
      ...toCatalogServiceParams(state),
      scope
    }),
    productService.listCategories(scope)
  ]);

  return (
    <CatalogScreen
      title={brand}
      subtitle="Страница бренда RSH: фильтруйте по цене, категории, сортировке и быстро переходите к нужным позициям."
      state={state}
      basePath={`/catalog/brands/${params.brandSlug}`}
      categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
      items={catalog.items}
      total={catalog.total}
      totalPages={catalog.totalPages}
      lockedBrand={brand}
    />
  );
}
