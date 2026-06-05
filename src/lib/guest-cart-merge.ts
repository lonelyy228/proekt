"use client";

import type { QueryClient } from "@tanstack/react-query";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { cartQueryKey, type CartState } from "@/hooks/use-cart";
import { useGuestCartStore } from "@/store/guest-cart-store";

type CartMergeResponse = {
  success: boolean;
  data?: CartState;
  error?: {
    message?: string;
  };
};

export const mergeGuestCartIntoAccount = async (queryClient: QueryClient): Promise<void> => {
  const { items, clear } = useGuestCartStore.getState();

  if (items.length === 0) {
    return;
  }

  const csrfToken = await ensureCsrfToken();
  const response = await fetch("/api/cart/merge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken
    },
    credentials: "include",
    body: JSON.stringify({
      guestItems: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        customizationId: item.customizationId ?? null
      }))
    })
  });

  const payload = (await response.json()) as CartMergeResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.message ?? "Не удалось перенести гостевую корзину в аккаунт");
  }

  clear();
  queryClient.setQueryData(cartQueryKey, payload.data);
  await queryClient.invalidateQueries({ queryKey: cartQueryKey });
};
