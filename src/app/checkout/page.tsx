"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { formatStoreMoney } from "@/lib/currency";
import { useCart, type CartItem } from "@/hooks/use-cart";

type CheckoutSessionResponse = {
  success: boolean;
  data?: {
    checkoutUrl: string | null;
    orderId: string;
  };
  error?: {
    message: string;
  };
};

const getItemDescriptor = (item: CartItem): string => {
  if (!item.customizationId) {
    return item.variantName;
  }

  const details = [item.variantName, item.customizationGarmentType, item.customizationColor].filter(Boolean);
  return `${details.join(" / ")} / кастом`;
};

export default function CheckoutPage(): JSX.Element {
  const { data: cart, isLoading, isError } = useCart();

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [line2, setLine2] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [line1, setLine1] = useState<string>("");
  const [postalCode, setPostalCode] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const cartCurrency = useMemo(() => cart?.items[0]?.currency ?? "USD", [cart?.items]);

  const shippingCents = useMemo(() => {
    const subtotal = cart?.subtotalCents ?? 0;
    return subtotal >= 10000 ? 0 : 999;
  }, [cart?.subtotalCents]);

  const taxCents = useMemo(() => Math.round((cart?.subtotalCents ?? 0) * 0.08), [cart?.subtotalCents]);
  const totalCents = useMemo(
    () => (cart?.subtotalCents ?? 0) + shippingCents + taxCents,
    [cart?.subtotalCents, shippingCents, taxCents]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage("");

    if (!cart || cart.items.length === 0) {
      setErrorMessage("Корзина пуста. Добавьте товары перед оформлением.");
      return;
    }

    setIsSubmitting(true);

    try {
      const csrfToken = await ensureCsrfToken();
      const origin = window.location.origin;

      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          successUrl: `${origin}/checkout/success`,
          cancelUrl: `${origin}/checkout/cancel`,
          shippingAddress: {
            firstName,
            lastName,
            city,
            state,
            line1,
            line2: line2.trim() || undefined,
            postalCode,
            country: "RU"
          }
        })
      });

      const payload = (await response.json()) as CheckoutSessionResponse;

      if (!response.ok || !payload.success || !payload.data?.checkoutUrl) {
        throw new Error(payload.error?.message ?? "Не удалось создать сессию оплаты");
      }

      window.location.href = payload.data.checkoutUrl;
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка оформления. Попробуйте позже.");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-2xl border bg-card p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">RSH checkout</p>
        <h1 className="mt-2 text-3xl font-semibold">Оформление заказа</h1>
        <p className="mt-3 text-sm text-muted-foreground">Загружаем корзину и проверяем товары...</p>
      </section>
    );
  }

  if (isError || !cart) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-destructive">RSH checkout</p>
        <h1 className="mt-2 text-3xl font-semibold">Не удалось открыть оформление</h1>
        <p className="mt-3 text-sm text-muted-foreground">Войдите в аккаунт заново или обновите страницу.</p>
        <Link href="/login" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Войти
        </Link>
      </section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="rounded-2xl border bg-card p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">RSH checkout</p>
        <h1 className="mt-2 text-3xl font-semibold">Корзина пуста</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Добавьте брендовую вещь из каталога или соберите кастомную базовую вещь в 2D Lab, после этого здесь появится оформление.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/catalog" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Открыть каталог
          </Link>
          <Link href="/editor" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            Создать кастом
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form className="space-y-4 rounded-xl border bg-card p-6" onSubmit={handleSubmit}>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Checkout</p>
          <h1 className="mt-2 text-3xl font-semibold">Оформление заказа</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Доставка оформляется по России. На витрине суммы показаны в рублях, а платежная валюта берется из товаров корзины.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm">Имя</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm">Фамилия</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm">Регион</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={state}
              onChange={(event) => setState(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm">Город</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm">Адрес</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={line1}
            onChange={(event) => setLine1(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Адрес (дополнительно)</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={line2}
            onChange={(event) => setLine2(event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Почтовый индекс</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            required
          />
        </label>

        <button
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Переходим к оплате..." : "Перейти к оплате Stripe"}
        </button>

        <p className="text-xs text-muted-foreground">
          После оплаты заказ подтвердится через Stripe webhook. Кастомные дизайны сохраняются вместе с исходным Fabric JSON и превью.
        </p>
      </form>

      <aside className="h-fit space-y-4 rounded-xl border bg-card p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Order summary</p>
          <h2 className="mt-2 text-xl font-semibold">Ваш заказ</h2>
        </div>
        <div className="space-y-2 text-sm">
          {cart.items.map((item) => (
            <article key={item.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-md border p-3">
              <div className="flex h-20 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                {item.customizationPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Fabric previews are generated data/object URLs.
                  <img src={item.customizationPreviewUrl} alt={`Превью ${item.productName}`} className="h-full w-full object-contain" />
                ) : (
                  <span className="px-2 text-center text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    RSH item
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.productName}</p>
                <p className="text-muted-foreground">{getItemDescriptor(item)}</p>
                <p className="text-muted-foreground">Количество: {item.quantity}</p>
                <p className="mt-1 font-medium">{formatStoreMoney(item.totalPriceCents, item.currency)}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Товары</span>
            <span>{formatStoreMoney(cart.subtotalCents, cartCurrency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Доставка</span>
            <span>{shippingCents === 0 ? "Бесплатно" : formatStoreMoney(shippingCents, cartCurrency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Налог</span>
            <span>{formatStoreMoney(taxCents, cartCurrency)}</span>
          </div>
          <div className="flex justify-between pt-2 text-base font-semibold">
            <span>Итого</span>
            <span>{formatStoreMoney(totalCents, cartCurrency)}</span>
          </div>
        </div>

        <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          Бесплатная доставка включается от {formatStoreMoney(10000, cartCurrency)}. Если в корзине кастом, его превью и исходный дизайн будут
          прикреплены к заказу.
        </p>
      </aside>
    </section>
  );
}
