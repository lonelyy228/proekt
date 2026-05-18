"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureCsrfToken } from "@/lib/csrf-client";

type CartItem = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  totalPriceCents: number;
  productName: string;
  variantName: string;
};

type CartState = {
  id: string;
  items: CartItem[];
  subtotalCents: number;
};

const fetchCart = async (): Promise<CartState> => {
  const response = await fetch("/api/cart", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить корзину");
  }
  const payload = (await response.json()) as { success: true; data: CartState };
  return payload.data;
};

export const useCart = () => {
  const queryClient = useQueryClient();

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: fetchCart
  });

  const upsertItem = useMutation({
    mutationFn: async (payload: { productId: string; variantId: string; quantity: number; customizationId?: string | null }) => {
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
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartState>(["cart"]);

      if (previous) {
        const match = previous.items.find(
          (item) => item.variantId === payload.variantId && item.productId === payload.productId
        );

        const nextItems = match
          ? previous.items.map((item) =>
              item.id === match.id
                ? {
                    ...item,
                    quantity: payload.quantity
                  }
                : item
            )
          : previous.items;

        queryClient.setQueryData<CartState>(["cart"], {
          ...previous,
          items: nextItems
        });
      }

      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["cart"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    }
  });

  return {
    ...cartQuery,
    upsertItem
  };
};
