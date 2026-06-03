"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCart, type CartItem } from "@/hooks/use-cart";
import { formatStoreMoney } from "@/lib/currency";

const getItemDescriptor = (item: CartItem): string => {
  if (!item.customizationId) {
    return item.variantName;
  }

  const details = [item.customizationGarmentType ?? "RSH 2D Lab", item.customizationColor].filter(Boolean);
  return `${item.variantName} · ${details.join(" · ")}`;
};

export default function CartPage(): JSX.Element {
  const { data, isLoading, isError, upsertItem, removeItem } = useCart();
  const isMutating = upsertItem.isPending || removeItem.isPending;
  const subtotalCurrency = useMemo(() => data?.items[0]?.currency ?? "RUB", [data?.items]);

  const changeQuantity = (item: CartItem, quantity: number): void => {
    if (quantity < 1) {
      removeItem.mutate(item.id);
      return;
    }

    upsertItem.mutate({
      productId: item.productId,
      variantId: item.variantId,
      quantity,
      customizationId: item.customizationId ?? null
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">RSH checkout</p>
        <h1 className="text-3xl font-semibold">Корзина</h1>
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Загружаем корзину...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">RSH checkout</p>
        <h1 className="text-3xl font-semibold">Корзина</h1>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-medium text-destructive">Не удалось загрузить корзину.</p>
          <p className="mt-2 text-sm text-muted-foreground">Попробуй обновить страницу или войти в аккаунт заново.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">RSH checkout</p>
          <h1 className="text-3xl font-semibold">Корзина</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalog" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            Продолжить покупки
          </Link>
          <Link href="/editor" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            Вернуться в 2D Lab
          </Link>
        </div>
      </header>

      {data.items.length === 0 ? (
        <section className="rounded-2xl border bg-card p-8">
          <p className="text-lg font-medium">Корзина пока пустая.</p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Можно выбрать брендовую вещь в каталоге или собрать кастомную базовую вещь в 2D Lab.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/catalog" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Открыть каталог
            </Link>
            <Link href="/editor" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Создать кастом
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="space-y-3">
            {data.items.map((item) => (
              <article key={item.id} className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-[132px_1fr]">
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
                  {item.customizationPreviewUrl ? (
                    <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Data URL previews come from Fabric export and cannot be optimized by next/image. */}
                    <img
                      src={item.customizationPreviewUrl}
                      alt={`Превью ${item.productName}`}
                      className="h-full w-full object-contain"
                    />
                    </>
                  ) : (
                    <span className="px-3 text-center text-xs text-muted-foreground">
                      {item.imageUrl ?? "RSH product"}
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">{getItemDescriptor(item)}</p>
                    </div>
                    {item.customizationId ? (
                      <div className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">
                        Кастомный дизайн сохранён и привязан к заказу
                      </div>
                    ) : null}
                    <p className="text-sm font-semibold">{formatStoreMoney(item.totalPriceCents, item.currency)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="inline-flex items-center rounded-lg border">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item, item.quantity - 1)}
                        disabled={isMutating}
                        className="px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Уменьшить количество"
                      >
                        -
                      </button>
                      <span className="min-w-10 border-x px-3 py-2 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item, item.quantity + 1)}
                        disabled={isMutating || item.quantity >= 50}
                        className="px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Увеличить количество"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem.mutate(item.id)}
                      disabled={isMutating}
                      className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <aside className="h-fit rounded-2xl border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Итог заказа</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Товары</span>
                <span>{data.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма</span>
                <span className="font-semibold">{formatStoreMoney(data.subtotalCents, subtotalCurrency)}</span>
              </div>
            </div>
            <Link
              href="/checkout"
              className="mt-5 inline-flex w-full justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
            >
              Оформить заказ
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              Для кастомных вещей в заказ попадает исходный дизайн и превью, а не только картинка.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
