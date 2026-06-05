"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/use-wishlist";
import { formatStoreMoney } from "@/lib/currency";

export default function FavoritesPage(): JSX.Element {
  const { data = [], isAuthenticated, isLoading, isError, toggle } = useWishlist();
  const items = useMemo(() => data, [data]);

  if (!isAuthenticated && !isLoading) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">RSH Wishlist</p>
        <h1 className="mt-3 text-4xl font-semibold">Избранное доступно после входа</h1>
        <p className="mt-3 text-muted-foreground">
          Войдите в аккаунт, чтобы сохранять вещи, возвращаться к ним позже и быстро собирать заказ.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground" href="/login?next=%2Ffavorites">
            Войти
          </Link>
          <Link className="rounded-md border px-5 py-3 text-sm font-medium" href="/register?next=%2Ffavorites">
            Зарегистрироваться
          </Link>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Загружаем избранное...</p>;
  }

  if (isError) {
    return <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Не удалось загрузить избранное.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">RSH Wishlist</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold">Избранное</h1>
            <p className="mt-2 text-sm text-muted-foreground">Сохранённые вещи для быстрого возврата к покупке.</p>
          </div>
          <span className="rounded-full border px-4 py-2 text-sm text-muted-foreground">{items.length} позиций</span>
        </div>
      </section>

      {items.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const image = item.product.images[0];
            const priceCents = item.variant?.priceCents ?? item.product.basePriceCents;
            const currency = item.variant?.currency ?? item.product.currency;

            return (
              <article key={item.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <Link href={`/product/${item.product.slug}`} className="relative block aspect-square bg-muted/30">
                  {image ? (
                    <Image src={image.url} alt={image.alt} fill sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,8,8,0.08),rgba(255,255,255,0.8))]" />
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-background/85 px-3 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur">
                    {item.product.brand}
                  </span>
                </Link>
                <div className="space-y-3 p-4">
                  <div>
                    <Link href={`/product/${item.product.slug}`} className="text-lg font-semibold underline-offset-2 hover:underline">
                      {item.product.name}
                    </Link>
                    {item.variant ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {item.variant.name} / {item.variant.size} / {item.variant.color}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{formatStoreMoney(priceCents, currency)}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : {}) })}
                    >
                      Убрать
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">Пока пусто</h2>
          <p className="mt-2 text-sm text-muted-foreground">Добавьте вещи из каталога, чтобы они появились здесь.</p>
          <Link className="mt-5 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground" href="/catalog">
            Перейти в каталог
          </Link>
        </section>
      )}
    </div>
  );
}
