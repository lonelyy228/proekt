"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ensureCsrfToken } from "@/lib/csrf-client";

export type WishlistItem = {
  id: string;
  productId: string;
  variantId: string | null;
  product: {
    id: string;
    slug: string;
    brand: string;
    name: string;
    basePriceCents: number;
    currency: string;
    images: Array<{
      id: string;
      url: string;
      alt: string;
    }>;
  };
  variant: {
    id: string;
    name: string;
    color: string;
    size: string;
    priceCents: number;
    currency: string;
  } | null;
};

type ToggleWishlistInput = {
  productId: string;
  variantId?: string;
};

export const wishlistQueryKey = ["wishlist"] as const;

const fetchWishlist = async (): Promise<WishlistItem[]> => {
  const response = await fetch("/api/wishlist", { credentials: "include" });

  if (!response.ok) {
    throw new Error("Не удалось загрузить избранное");
  }

  const payload = (await response.json()) as { success: true; data: WishlistItem[] };
  return payload.data;
};

export const useWishlist = () => {
  const queryClient = useQueryClient();
  const authQuery = useAuth();
  const userId = authQuery.data?.id;

  const wishlistQuery = useQuery({
    queryKey: wishlistQueryKey,
    queryFn: fetchWishlist,
    enabled: Boolean(userId)
  });

  const toggle = useMutation({
    mutationFn: async (payload: ToggleWishlistInput) => {
      if (!userId) {
        throw new Error("Войдите, чтобы пользоваться избранным");
      }

      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/wishlist/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Не удалось обновить избранное");
      }

      return (await response.json()) as { success: true; data: { added: boolean } };
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: wishlistQueryKey });

      const previous = queryClient.getQueryData<WishlistItem[]>(wishlistQueryKey);
      const variantId = payload.variantId ?? null;

      if (previous?.some((item) => item.productId === payload.productId && item.variantId === variantId)) {
        queryClient.setQueryData<WishlistItem[]>(
          wishlistQueryKey,
          previous.filter((item) => item.productId !== payload.productId || item.variantId !== variantId)
        );
      }

      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(wishlistQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wishlistQueryKey });
    }
  });

  return {
    ...wishlistQuery,
    data: userId ? wishlistQuery.data : [],
    isLoading: authQuery.isLoading || wishlistQuery.isLoading,
    isAuthenticated: Boolean(userId),
    toggle
  };
};
