"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureCsrfToken } from "@/lib/csrf-client";

export type CartItem = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  currency: string;
  unitPriceCents: number;
  totalPriceCents: number;
  productName: string;
  variantName: string;
  imageUrl?: string | null;
  customizationId?: string | null;
  customizationPreviewUrl?: string | null;
  customizationGarmentType?: string | null;
  customizationColor?: string | null;
};

export type CartState = {
  id: string;
  items: CartItem[];
  subtotalCents: number;
};

type UpsertCartItemInput = {
  productId: string;
  variantId: string;
  quantity: number;
  customizationId?: string | null;
};

export const cartQueryKey = ["cart"] as const;

const fetchCart = async (): Promise<CartState> => {
  const response = await fetch("/api/cart", { credentials: "include" });

  if (!response.ok) {
    throw new Error("Не удалось загрузить корзину");
  }

  const payload = (await response.json()) as { success: true; data: CartState };
  return payload.data;
};

const recalculateCart = (cart: CartState): CartState => ({
  ...cart,
  subtotalCents: cart.items.reduce((sum, item) => {
    const unitPriceCents = item.unitPriceCents || Math.floor(item.totalPriceCents / Math.max(1, item.quantity));
    return sum + unitPriceCents * item.quantity;
  }, 0)
});

export const useCart = () => {
  const queryClient = useQueryClient();

  const cartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: fetchCart
  });

  const upsertItem = useMutation({
    mutationFn: async (payload: UpsertCartItemInput) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Не удалось обновить корзину");
      }

      return (await response.json()) as { success: true; data: CartState };
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previous = queryClient.getQueryData<CartState>(cartQueryKey);

      if (previous) {
        const nextItems = previous.items.map((item) => {
          const sameCommercialItem =
            item.variantId === payload.variantId &&
            item.productId === payload.productId &&
            (item.customizationId ?? null) === (payload.customizationId ?? null);

          if (!sameCommercialItem) {
            return item;
          }

          const unitPriceCents = item.unitPriceCents || Math.floor(item.totalPriceCents / Math.max(1, item.quantity));

          return {
            ...item,
            quantity: payload.quantity,
            totalPriceCents: unitPriceCents * payload.quantity
          };
        });

        queryClient.setQueryData<CartState>(cartQueryKey, recalculateCart({ ...previous, items: nextItems }));
      }

      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
    }
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/cart/items?itemId=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Не удалось удалить товар из корзины");
      }

      return (await response.json()) as { success: true; data: CartState };
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previous = queryClient.getQueryData<CartState>(cartQueryKey);

      if (previous) {
        const nextItems = previous.items.filter((item) => item.id !== itemId);
        queryClient.setQueryData<CartState>(cartQueryKey, recalculateCart({ ...previous, items: nextItems }));
      }

      return { previous };
    },
    onError: (_error, _itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
    }
  });

  return {
    ...cartQuery,
    upsertItem,
    removeItem
  };
};