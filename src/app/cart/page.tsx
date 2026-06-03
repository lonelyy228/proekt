"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatStoreMoney } from "@/lib/currency";

type CartPayload = {
  id: string;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    quantity: number;
    currency: string;
    totalPriceCents: number;
    imageUrl?: string | null;
    customizationId?: string | null;
    customizationPreviewUrl?: string | null;
    customizationGarmentType?: string | null;
    customizationColor?: string | null;
  }>;
  subtotalCents: number;
};

const fetchCart = async (): Promise<CartPayload> => {
  const response = await fetch("/api/cart", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить корзину");
  }

  const payload = (await response.json()) as { success: boolean; data: CartPayload };
  return payload.data;
};

export default function CartPage(): JSX.Element {
    const { data, isLoading, isError } = useQuery({
    queryKey: ["cart"],
    queryFn: fetchCart
  });

  if (isLoading) {
    return <p>Загружаем корзину...</p>;
  }

  if (isError || !data) {
    return <p>Не удалось загрузить корзину.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Корзина</h1>
      <div className="space-y-3">
        {data.items.length === 0 ? <p className="text-sm text-muted-foreground">Корзина пуста.</p> : null}
        {data.items.map((item) => (
          <article key={item.id} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[120px_1fr]">
            <div className="flex h-28 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
              {item.customizationPreviewUrl ? (
                <img
                  src={item.customizationPreviewUrl}
                  alt={`Preview ${item.productName}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="px-3 text-center text-xs text-muted-foreground">{item.imageUrl}</span>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-medium">{item.productName}</p>
              <p className="text-sm text-muted-foreground">{item.variantName}</p>
              {item.customizationId ? (
                <p className="text-sm text-primary">
                  Кастомный дизайн: {item.customizationGarmentType ?? "RSH 2D Lab"}
                  {item.customizationColor ? ` · ${item.customizationColor}` : ""}
                </p>
              ) : null}
              <p className="text-sm">Количество: {item.quantity}</p>
              <p className="text-sm font-semibold">{formatStoreMoney(item.totalPriceCents, item.currency)}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="font-semibold">Итого: {formatStoreMoney(data.subtotalCents, data.items[0]?.currency ?? "USD")}</p>
      {data.items.length > 0 ? (
        <Link href="/checkout" className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Оформить заказ
        </Link>
      ) : null}
    </div>
  );
}


