import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { isCustomizerBaseBrand } from "@/config/customizer";
import { getBrandProfile } from "@/features/catalog/brand-profile";
import { brandToSlug } from "@/features/catalog/brand-directory";
import { ProductPurchasePanel } from "@/features/catalog/components/product-purchase-panel";
import { formatStoreMoney } from "@/lib/currency";
import { productService } from "@/server/services/product-service";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { slug: string } }): Promise<JSX.Element> {
  const product = await productService.getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await productService.getRelatedProducts(params.slug);
  const profile = getBrandProfile(product.brand);
  const isBaseCustomizerProduct = isCustomizerBaseBrand(product.brand);
  const primaryImage = product.images[0] ?? null;

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-2xl border bg-[linear-gradient(140deg,rgba(8,8,8,0.12),rgba(255,255,255,0.72))] shadow-sm">
            {primaryImage ? (
              <Image
                src={primaryImage.url}
                alt={primaryImage.alt}
                fill
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.85),transparent_34%),linear-gradient(140deg,rgba(8,8,8,0.12),rgba(255,255,255,0.72))]" />
            )}
            <div className="absolute left-4 top-4 rounded-full bg-background/85 px-3 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur">
              RSH selected
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Оценка состояния</p>
              <p className="mt-2 text-lg font-semibold">{profile.conditionScale}</p>
            </article>
            <article className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Фокус бренда</p>
              <p className="mt-2 text-sm text-muted-foreground">{profile.focus}</p>
            </article>
          </div>
        </div>

        <div className="space-y-5">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
            Подлинность проверена
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

          <ProductPurchasePanel
            product={{
              id: product.id,
              name: product.name,
              brand: product.brand,
              isBaseCustomizerProduct
            }}
            variants={product.variants.map((variant) => ({
              id: variant.id,
              name: variant.name,
              color: variant.color,
              size: variant.size,
              priceCents: variant.priceCents,
              currency: variant.currency,
              isDefault: variant.isDefault
            }))}
          />

          <article className="rounded-xl border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Комментарий по вещи</p>
            <p className="mt-2 text-sm text-muted-foreground">{profile.archiveNote}</p>
          </article>

          <article className="rounded-xl border bg-card p-4">
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
          {isBaseCustomizerProduct ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Для базовой линейки RSH BASICS доступна персонализация в 2D-редакторе: добавляйте текст, фото и графику, а затем сохраняйте дизайн в профиль.
              </p>
              <Link
                href="/editor"
                className="mt-4 inline-block rounded-md border px-3 py-2 text-sm transition hover:border-primary hover:text-primary"
              >
                Открыть RSH 2D Lab
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Эта позиция относится к брендовой линейке. Кастомизация для брендовых вещей отключена, чтобы не нарушать целостность товара и бренда.
            </p>
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
            <Link key={item.id} href={`/product/${item.slug}`} className="group rounded-xl border p-3 transition hover:border-primary">
              <div className="relative mb-3 aspect-square overflow-hidden rounded-md border bg-muted/30">
                {item.images[0] ? (
                  <Image
                    src={item.images[0].url}
                    alt={item.images[0].alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : null}
              </div>
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
