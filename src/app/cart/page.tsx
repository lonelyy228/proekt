"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCart, type CartItem } from "@/hooks/use-cart";
import { formatStoreMoney } from "@/lib/currency";

const FREE_SHIPPING_THRESHOLD_CENTS = 10000;

const getItemDescriptor = (item: CartItem): string => {
  if (!item.customizationId) {
    return item.variantName;
  }

  const details = [item.customizationGarmentType ?? "RSH 2D Lab", item.customizationColor].filter(Boolean);
  return `${item.variantName} / ${details.join(" / ")}`;
};

const CartItemImage = ({ item }: { item: CartItem }): JSX.Element => {
  const imageSrc = item.customizationPreviewUrl ?? item.imageUrl ?? null;

  if (!imageSrc) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border bg-muted/30 px-4 text-center text-xs uppercase tracking-[0.16em] text-muted-foreground">
        RSH item
      </div>
    );
  }

  return (
    <div className="h-32 overflow-hidden rounded-xl border bg-muted/30">
      {/* eslint-disable-next-line @next/next/no-img-element -- Cart previews can be uploaded/custom generated URLs. */}
      <img src={imageSrc} alt={`Превью ${item.productName}`} className="h-full w-full object-cover" />
    </div>
  );
};

export default function CartPage(): JSX.Element {
  const { data, isLoading, isError, isAuthenticated, upsertItem, removeItem } = useCart();
  const isMutating = upsertItem.isPending || removeItem.isPending;
  const subtotalCurrency = useMemo(() => data?.items[0]?.currency ?? "RUB", [data?.items]);
  const totalQuantity = useMemo(() => data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [data?.items]);
  const freeShippingLeft = Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - (data?.subtotalCents ?? 0));
  const freeShippingProgress = Math.min(100, Math.round(((data?.subtotalCents ?? 0) / FREE_SHIPPING_THRESHOLD_CENTS) * 100));

  const changeQuantity = (item: CartItem, quantity: number): void => {
    if (quantity < 1) {
      removeItem.mutate(item.id);
      return;
    }

    upsertItem.mutate({
      productId: item.productId,
      variantId: item.variantId,
      quantity,
      customizationId: item.customizationId ?? null,
      currency: item.currency,
      unitPriceCents: item.unitPriceCents,
      productName: item.productName,
      variantName: item.variantName,
      imageUrl: item.imageUrl ?? null,
      customizationPreviewUrl: item.customizationPreviewUrl ?? null,
      customizationGarmentType: item.customizationGarmentType ?? null,
      customizationColor: item.customizationColor ?? null
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
          <p className="mt-2 text-sm text-muted-foreground">Обновите страницу или войдите в аккаунт заново.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/login?next=%2Fcart" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Войти
            </Link>
            <Link href="/catalog" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              В каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">RSH checkout</p>
            <h1 className="mt-2 text-4xl font-semibold">Корзина</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Проверьте размеры, количество и кастомные дизайны перед оформлением заказа.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/catalog" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Продолжить покупки
            </Link>
            <Link href="/editor" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Открыть 2D Lab
            </Link>
          </div>
        </div>
      </header>

      {!isAuthenticated && data.items.length > 0 ? (
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Вы собираете заказ как гость.</p>
          <p className="mt-1 text-muted-foreground">
            Товары не пропадут: после входа или регистрации мы автоматически перенесём эту корзину в ваш аккаунт.
          </p>
        </section>
      ) : null}

      {data.items.length === 0 ? (
        <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Empty cart</p>
          <h2 className="mt-3 text-3xl font-semibold">Корзина пока пустая</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Выберите брендовую вещь в каталоге или соберите кастомную базовую вещь в RSH 2D Lab.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/catalog" className="rounded-md bg-primary px-5 py-3 text-sm text-primary-foreground">
              Открыть каталог
            </Link>
            <Link href="/editor" className="rounded-md border px-5 py-3 text-sm hover:bg-muted">
              Создать кастом
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <section className="space-y-3">
            {data.items.map((item) => (
              <article key={item.id} className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-[132px_1fr]">
                <CartItemImage item={item} />

                <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">{getItemDescriptor(item)}</p>
                    </div>
                    {item.customizationId ? (
                      <div className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">
                        Кастомный дизайн будет прикреплён к заказу
                      </div>
                    ) : null}
                    <p className="text-sm font-semibold">{formatStoreMoney(item.totalPriceCents, item.currency)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <div className="inline-flex items-center rounded-lg border bg-background">
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

          <aside className="h-fit space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Итог заказа</p>
              <h2 className="mt-2 text-2xl font-semibold">{formatStoreMoney(data.subtotalCents, subtotalCurrency)}</h2>
            </div>

            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Позиции</span>
                <span>{data.items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Количество</span>
                <span>{totalQuantity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Товары</span>
                <span className="font-semibold">{formatStoreMoney(data.subtotalCents, subtotalCurrency)}</span>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>Доставка</span>
                <span>{freeShippingLeft === 0 ? "Включена" : "Осталось"}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${freeShippingProgress}%` }} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {freeShippingLeft === 0
                  ? "Бесплатная доставка применится на checkout."
                  : `До бесплатной доставки осталось ${formatStoreMoney(freeShippingLeft, subtotalCurrency)}.`}
              </p>
            </div>

            <Link
              href={isAuthenticated ? "/checkout" : "/login?next=%2Fcheckout"}
              className="inline-flex w-full justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
            >
              {isAuthenticated ? "Оформить заказ" : "Войти и оформить"}
            </Link>
            <p className="text-xs text-muted-foreground">
              {isAuthenticated
                ? "В демо-режиме заказ можно завершить локально без реальной оплаты. В production подключается Stripe Checkout и webhook."
                : "После входа товары из гостевой корзины будут перенесены в аккаунт и останутся доступны в checkout."}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
