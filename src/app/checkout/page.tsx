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

type ShippingFormState = {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

const demoAddress: ShippingFormState = {
  firstName: "Алексей",
  lastName: "Иванов",
  state: "Москва",
  city: "Москва",
  line1: "Тверская улица, 12",
  line2: "кв. 45",
  postalCode: "125009"
};

const emptyAddress: ShippingFormState = {
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: ""
};

const getCheckoutItemImage = (item: CartItem): string | null => item.customizationPreviewUrl ?? item.imageUrl ?? null;

const getItemDescriptor = (item: CartItem): string => {
  if (!item.customizationId) {
    return item.variantName;
  }

  const details = [item.variantName, item.customizationGarmentType, item.customizationColor].filter(Boolean);
  return `${details.join(" / ")} / кастом`;
};

export default function CheckoutPage(): JSX.Element {
  const { data: cart, isLoading, isError } = useCart();
  const [form, setForm] = useState<ShippingFormState>(emptyAddress);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const cartCurrency = useMemo(() => cart?.items[0]?.currency ?? "RUB", [cart?.items]);
  const shippingCents = useMemo(() => {
    const subtotal = cart?.subtotalCents ?? 0;
    return subtotal >= 10000 ? 0 : 999;
  }, [cart?.subtotalCents]);
  const taxCents = useMemo(() => Math.round((cart?.subtotalCents ?? 0) * 0.08), [cart?.subtotalCents]);
  const totalCents = useMemo(
    () => (cart?.subtotalCents ?? 0) + shippingCents + taxCents,
    [cart?.subtotalCents, shippingCents, taxCents]
  );

  const updateField = (field: keyof ShippingFormState, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage("");

    if (!cart || cart.items.length === 0) {
      setErrorMessage("Корзина пустая. Добавьте товары перед оформлением.");
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
            firstName: form.firstName,
            lastName: form.lastName,
            city: form.city,
            state: form.state,
            line1: form.line1,
            line2: form.line2.trim() || undefined,
            postalCode: form.postalCode,
            country: "RU"
          }
        })
      });

      const payload = (await response.json()) as CheckoutSessionResponse;

      if (!response.ok || !payload.success || !payload.data?.checkoutUrl) {
        throw new Error(payload.error?.message ?? "Не удалось создать заказ. Попробуйте ещё раз.");
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
        <Link href="/login?next=%2Fcheckout" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Войти
        </Link>
      </section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">RSH checkout</p>
        <h1 className="mt-2 text-3xl font-semibold">Корзина пустая</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Добавьте брендовую вещь из каталога или соберите кастомную базовую вещь в 2D Lab, после этого здесь появится оформление заказа.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
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
    <section className="space-y-6">
      <header className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Checkout</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-4xl font-semibold">Оформление заказа</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Проверяем адрес, фиксируем состав корзины и создаём заказ. В демо-режиме оплата завершается локально без реального списания.
            </p>
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-full border text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span className="bg-primary px-4 py-2 text-primary-foreground">Корзина</span>
            <span className="px-4 py-2">Адрес</span>
            <span className="px-4 py-2">Оплата</span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form className="space-y-5 rounded-xl border bg-card p-6 shadow-sm" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Адрес доставки</h2>
              <p className="mt-1 text-sm text-muted-foreground">Для показа можно быстро заполнить тестовый адрес.</p>
            </div>
            <button type="button" className="rounded-md border px-4 py-2 text-sm hover:bg-muted" onClick={() => setForm(demoAddress)}>
              Заполнить демо-адрес
            </button>
          </div>

          {errorMessage ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1" htmlFor="checkout-first-name">
              <span className="text-sm">Имя</span>
              <input
                id="checkout-first-name"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                required
                autoComplete="given-name"
              />
            </label>
            <label className="block space-y-1" htmlFor="checkout-last-name">
              <span className="text-sm">Фамилия</span>
              <input
                id="checkout-last-name"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                required
                autoComplete="family-name"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1" htmlFor="checkout-state">
              <span className="text-sm">Регион</span>
              <input
                id="checkout-state"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.state}
                onChange={(event) => updateField("state", event.target.value)}
                required
                autoComplete="address-level1"
              />
            </label>
            <label className="block space-y-1" htmlFor="checkout-city">
              <span className="text-sm">Город</span>
              <input
                id="checkout-city"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                required
                autoComplete="address-level2"
              />
            </label>
          </div>

          <label className="block space-y-1" htmlFor="checkout-line1">
            <span className="text-sm">Адрес</span>
            <input
              id="checkout-line1"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.line1}
              onChange={(event) => updateField("line1", event.target.value)}
              required
              autoComplete="address-line1"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="block space-y-1" htmlFor="checkout-line2">
              <span className="text-sm">Квартира / офис</span>
              <input
                id="checkout-line2"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.line2}
                onChange={(event) => updateField("line2", event.target.value)}
                autoComplete="address-line2"
              />
            </label>
            <label className="block space-y-1" htmlFor="checkout-postal-code">
              <span className="text-sm">Индекс</span>
              <input
                id="checkout-postal-code"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
                required
                autoComplete="postal-code"
              />
            </label>
          </div>

          <button className="w-full rounded-md bg-primary px-4 py-3 text-primary-foreground disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Создаём заказ..." : "Перейти к оплате"}
          </button>

          <p className="text-xs text-muted-foreground">
            В production заказ подтверждается через Stripe webhook. В локальном демо при placeholder-ключе Stripe заказ сразу переходит в статус «Оплачен».
          </p>
        </form>

        <aside className="h-fit space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Order summary</p>
            <h2 className="mt-2 text-xl font-semibold">Ваш заказ</h2>
          </div>
          <div className="space-y-2 text-sm">
            {cart.items.map((item) => (
              <article key={item.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-md border p-3">
                <div className="flex h-20 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                  {getCheckoutItemImage(item) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Checkout previews can be generated or uploaded URLs.
                    <img src={getCheckoutItemImage(item) ?? ""} alt={`Превью ${item.productName}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-[10px] uppercase tracking-[0.12em] text-muted-foreground">RSH item</span>
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
            Бесплатная доставка включается от {formatStoreMoney(10000, cartCurrency)}. Если в корзине есть кастом, его превью и исходный дизайн будут прикреплены к заказу.
          </p>
        </aside>
      </div>
    </section>
  );
}
