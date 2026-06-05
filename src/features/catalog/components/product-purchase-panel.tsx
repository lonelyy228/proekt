"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatStoreMoney } from "@/lib/currency";
import { useCart } from "@/hooks/use-cart";

type ProductVariantOption = {
  id: string;
  name: string;
  color: string;
  size: string;
  priceCents: number;
  currency: string;
  isDefault: boolean;
};

type ProductPurchasePanelProps = {
  product: {
    id: string;
    name: string;
    brand: string;
    imageUrl?: string | null;
    isBaseCustomizerProduct: boolean;
  };
  variants: ProductVariantOption[];
};

export const ProductPurchasePanel = ({ product, variants }: ProductPurchasePanelProps): JSX.Element => {
  const queryClient = useQueryClient();
  const { isAuthenticated, upsertItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState(
    variants.find((variant) => variant.isDefault)?.id ?? variants[0]?.id ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
    [selectedVariantId, variants]
  );

  const canSubmit = Boolean(selectedVariant) && quantity >= 1 && quantity <= 50 && !isPending && !upsertItem.isPending;

  const addToCart = (): void => {
    if (!selectedVariant || !canSubmit) {
      return;
    }

    setMessage(null);
    setMessageType(null);

    startTransition(() => {
      upsertItem.mutate(
        {
          productId: product.id,
          variantId: selectedVariant.id,
          quantity,
          customizationId: null,
          currency: selectedVariant.currency,
          unitPriceCents: selectedVariant.priceCents,
          productName: product.name,
          variantName: selectedVariant.name,
          imageUrl: product.imageUrl ?? null
        },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["cart"] });
            setMessage(
              isAuthenticated
                ? "Товар добавлен в корзину. Можно продолжить покупки или перейти к оформлению."
                : "Товар добавлен во временную корзину. После входа мы перенесём его в ваш аккаунт."
            );
            setMessageType("success");
          },
          onError: () => {
            setMessage("Не удалось добавить товар в корзину. Проверьте соединение и попробуйте снова.");
            setMessageType("error");
          }
        }
      );
    });
  };

  if (variants.length === 0) {
    return (
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm font-medium text-destructive">Сейчас товар недоступен для заказа.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          У позиции пока нет активных вариантов. Мы не дадим оформить некорректный заказ.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Покупка</p>
          <h2 className="mt-1 text-2xl font-semibold">
            {formatStoreMoney(selectedVariant?.priceCents ?? 0, selectedVariant?.currency ?? "RUB")}
          </h2>
        </div>
        <span className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {product.brand}
        </span>
      </div>

      <fieldset className="mt-5 space-y-3">
        <legend className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Размер и цвет</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {variants.map((variant) => {
            const isSelected = variant.id === selectedVariantId;

            return (
              <label
                key={variant.id}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  isSelected ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={variant.id}
                  checked={isSelected}
                  onChange={() => setSelectedVariantId(variant.id)}
                  className="sr-only"
                />
                <span className="block text-sm font-medium">{variant.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Размер {variant.size} · цвет {variant.color}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border bg-background">
          <button
            type="button"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="px-3 py-2 text-sm"
            aria-label="Уменьшить количество"
          >
            -
          </button>
          <span className="min-w-12 border-x px-4 py-2 text-center text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((current) => Math.min(50, current + 1))}
            className="px-3 py-2 text-sm"
            aria-label="Увеличить количество"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={addToCart}
          disabled={!canSubmit}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending || upsertItem.isPending ? "Добавляем..." : "Добавить в корзину"}
        </button>
      </div>

      {product.isBaseCustomizerProduct ? (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="font-medium">Эту базовую вещь можно купить чистой или кастомизировать в RSH 2D Lab.</p>
          <Link href="/editor" className="mt-2 inline-block text-primary underline-offset-2 hover:underline">
            Открыть редактор
          </Link>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
          Брендовые позиции продаются как готовые вещи. Кастомизация доступна только для линейки RSH BASICS.
        </p>
      )}

      {message ? (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm ${
            messageType === "success" ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <p className={messageType === "error" ? "text-destructive" : "text-emerald-700"}>{message}</p>
          {messageType === "success" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/cart" className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground">
                Перейти в корзину
              </Link>
              <Link href="/catalog" className="rounded-md border px-3 py-2 text-xs hover:bg-muted">
                Продолжить покупки
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
