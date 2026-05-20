import Link from "next/link";
import { notFound } from "next/navigation";
import { brandToSlug } from "@/features/catalog/brand-directory";
import { getBrandProfile } from "@/features/catalog/brand-profile";
import { formatStoreMoney } from "@/lib/currency";
import { productService } from "@/server/services/product-service";
import { isCustomizerBaseBrand } from "@/config/customizer";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { slug: string } }): Promise<JSX.Element> {
  const product = await productService.getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await productService.getRelatedProducts(params.slug);
  const profile = getBrandProfile(product.brand);
  const customizableProduct = isCustomizerBaseBrand(product.brand);

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="aspect-square rounded-xl border bg-[linear-gradient(140deg,rgba(8,8,8,0.12),rgba(255,255,255,0.72))]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border bg-card p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Оценка состояния</p>
              <p className="mt-2 text-lg font-semibold">{profile.conditionScale}</p>
            </article>
            <article className="rounded-lg border bg-card p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Фокус бренда</p>
              <p className="mt-2 text-sm text-muted-foreground">{profile.focus}</p>
            </article>
          </div>
        </div>

        <div className="space-y-5">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
            Подлинность подтверждена
          </div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Product Dossier</p>
          <Link
            href={`/catalog/brands/${brandToSlug(product.brand)}`}
            className="text-sm uppercase tracking-[0.18em] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {product.brand}
          </Link>
          <h1 className="text-5xl leading-[0.92] tracking-[0.04em]" style={{ fontFamily: "var(--font-heading)" }}>
            {product.name}
          </h1>
          <p className="text-muted-foreground">{product.description}</p>
          <p className="text-2xl font-semibold">{formatStoreMoney(product.basePriceCents, product.currency)}</p>

          <article className="rounded-lg border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Комментарий по вещи</p>
            <p className="mt-2 text-sm text-muted-foreground">{profile.archiveNote}</p>
          </article>

          <article className="rounded-lg border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Стилистический сигнал</p>
            <p className="mt-2 text-sm text-muted-foreground">{profile.stylingSignal}</p>
          </article>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Протокол подлинности</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {profile.authenticityProtocol.map((item) => (
              <li key={item} className="rounded-md border border-border/70 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Кастомизация</p>
          {customizableProduct ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Это базовая модель RSH Basics. Ее можно кастомизировать в 2D Lab: добавить текст, графику, слои и
                сохранить дизайн в профиль.
              </p>
              <Link
                href="/editor"
                className="mt-4 inline-block rounded-md border px-3 py-2 text-sm transition hover:border-primary hover:text-primary"
              >
                Открыть RSH 2D Lab
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Брендовые вещи продаются только в оригинальном виде и не кастомизируются. Для персонализации используй
                базовую линейку RSH Basics в 2D Lab.
              </p>
              <Link
                href="/editor"
                className="mt-4 inline-block rounded-md border px-3 py-2 text-sm transition hover:border-primary hover:text-primary"
              >
                Перейти в RSH 2D Lab
              </Link>
            </>
          )}
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Таймлайн дропа</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {profile.dropTimeline.map((item) => (
              <li key={item} className="rounded-md border border-border/70 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Материалы и происхождение</p>
          <p className="mt-3 text-sm text-muted-foreground">{profile.materialsOrigin}</p>
        </article>

        <article className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Уход</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {profile.careCard.map((item) => (
              <li key={item} className="rounded-md border border-border/70 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Похожие товары</h2>
        {relatedProducts.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет похожих позиций.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {relatedProducts.map((item) => (
            <Link key={item.id} href={`/product/${item.slug}`} className="rounded-lg border p-4 transition hover:border-primary">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.brand}</p>
              <p className="mt-2 font-medium">{item.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{formatStoreMoney(item.basePriceCents, item.currency)}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
