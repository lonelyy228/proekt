"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { formatStoreMoney } from "@/lib/currency";

type CartPayload = {
  id: string;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    quantity: number;
    totalPriceCents: number;
  }>;
  subtotalCents: number;
};

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

const fetchCart = async (): Promise<CartPayload> => {
  const response = await fetch("/api/cart", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить корзину");
  }

  const payload = (await response.json()) as { success: boolean; data: CartPayload };
  return payload.data;
};

export default function CheckoutPage(): JSX.Element {
  const { data: cart, isLoading, isError } = useQuery({
    queryKey: ["cart", "checkout"],
    queryFn: fetchCart
  });

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [line2, setLine2] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [line1, setLine1] = useState<string>("");
  const [postalCode, setPostalCode] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

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
    return <p>Загружаем оформление заказа...</p>;
  }

  if (isError || !cart) {
    return <p>Не удалось открыть оформление заказа.</p>;
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form className="space-y-4 rounded-xl border bg-card p-6" onSubmit={handleSubmit}>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Checkout</p>
          <h1 className="mt-2 text-3xl font-semibold">Оформление заказа</h1>
          <p className="mt-2 text-sm text-muted-foreground">Доставка оформляется по России, сумма отображается в рублях.</p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

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
      </form>

      <aside className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Ваш заказ</h2>
        <div className="space-y-2 text-sm">
          {cart.items.map((item) => (
            <article key={item.id} className="rounded-md border p-3">
              <p className="font-medium">{item.productName}</p>
              <p className="text-muted-foreground">{item.variantName}</p>
              <p className="text-muted-foreground">Количество: {item.quantity}</p>
              <p className="font-medium">{formatStoreMoney(item.totalPriceCents, "USD" )}</p>
            </article>
          ))}
        </div>

        <div className="space-y-1 border-t pt-3 text-sm">
          <p>Товары: {formatStoreMoney(cart.subtotalCents, "USD" )}</p>
          <p>Доставка: {formatStoreMoney(shippingCents, "USD" )}</p>
          <p>Налог: {formatStoreMoney(taxCents, "USD" )}</p>
          <p className="pt-1 text-base font-semibold">Итого: {formatStoreMoney(totalCents, "USD" )}</p>
        </div>
      </aside>
    </section>
  );
}


