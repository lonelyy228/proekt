import Link from "next/link";
import { brandToSlug } from "@/features/catalog/brand-directory";
import { formatStoreMoney } from "@/lib/currency";
import { ProductListItem } from "@/types/domain";

export const ProductGrid = ({ products }: { products: ProductListItem[] }): JSX.Element => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {products.map((product) => (
      <article key={product.id} className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-4 aspect-square rounded-lg border bg-[linear-gradient(140deg,rgba(8,8,8,0.12),rgba(255,255,255,0.72))]" />
        <div className="flex items-center justify-between">
          <Link
            href={`/catalog/brands/${brandToSlug(product.brand)}`}
            className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {product.brand}
          </Link>
          <span className="rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.18em]">Проверено</span>
        </div>
        <h3 className="mt-1 text-lg font-medium">{product.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{product.category}</p>
        <p className="mt-2 text-sm font-semibold">{formatStoreMoney(product.basePriceCents, product.currency)}</p>
        <Link
          href={`/product/${product.slug}`}
          className="mt-4 inline-block text-sm text-primary underline-offset-2 hover:underline"
        >
          Открыть карточку
        </Link>
      </article>
    ))}
  </div>
);
