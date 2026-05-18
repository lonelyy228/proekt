"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureCsrfToken } from "@/lib/csrf-client";

type WishlistItem = {
  id: string;
  productId: string;
  variantId: string | null;
  product: {
    name: string;
  };
};

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

  const wishlistQuery = useQuery({
    queryKey: ["wishlist"],
    queryFn: fetchWishlist
  });

  const toggle = useMutation({
    mutationFn: async (payload: { productId: string; variantId?: string }) => {
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["wishlist"] });
      return { previous: queryClient.getQueryData<WishlistItem[]>(["wishlist"]) };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["wishlist"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    }
  });

  return {
    ...wishlistQuery,
    toggle
  };
};
