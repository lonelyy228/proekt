"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { useAuth } from "@/hooks/use-auth";
import { useGuestCartStore, type GuestCartItem } from "@/store/guest-cart-store";

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
  currency?: string;
  unitPriceCents?: number;
  productName?: string;
  variantName?: string;
  imageUrl?: string | null;
  customizationPreviewUrl?: string | null;
  customizationGarmentType?: string | null;
  customizationColor?: string | null;
};

type MutationLike<TPayload> = {
  mutate: (
    payload: TPayload,
    options?: {
      onSuccess?: () => void | Promise<void>;
      onError?: () => void;
    }
  ) => void;
  isPending: boolean;
};

type UseCartResult = {
  data?: CartState;
  isLoading: boolean;
  isError: boolean;
  isAuthenticated: boolean;
  upsertItem: MutationLike<UpsertCartItemInput>;
  removeItem: MutationLike<string>;
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

const toCartItem = (item: GuestCartItem): CartItem => ({
  ...item,
  totalPriceCents: item.unitPriceCents * item.quantity
});

const buildGuestCart = (items: GuestCartItem[]): CartState => {
  const cartItems = items.map(toCartItem);

  return {
    id: "guest-cart",
    items: cartItems,
    subtotalCents: cartItems.reduce((sum, item) => sum + item.totalPriceCents, 0)
  };
};

const toGuestCartItem = (payload: UpsertCartItemInput): Omit<GuestCartItem, "id"> => ({
  productId: payload.productId,
  variantId: payload.variantId,
  quantity: payload.quantity,
  customizationId: payload.customizationId ?? null,
  currency: payload.currency ?? "RUB",
  unitPriceCents: payload.unitPriceCents ?? 0,
  productName: payload.productName ?? "RSH item",
  variantName: payload.variantName ?? "Стандарт",
  imageUrl: payload.imageUrl ?? null,
  customizationPreviewUrl: payload.customizationPreviewUrl ?? null,
  customizationGarmentType: payload.customizationGarmentType ?? null,
  customizationColor: payload.customizationColor ?? null
});

const useGuestCartHydration = (): boolean => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    const persistApi = useGuestCartStore.persist;

    if (!persistApi) {
      setHasHydrated(true);
      return;
    }

    setHasHydrated(persistApi.hasHydrated());

    const unsubscribeHydrate = persistApi.onHydrate(() => {
      setHasHydrated(false);
    });
    const unsubscribeFinishHydration = persistApi.onFinishHydration(() => {
      setHasHydrated(true);
    });

    return () => {
      unsubscribeHydrate();
      unsubscribeFinishHydration();
    };
  }, []);

  return hasHydrated;
};

export const useCart = (): UseCartResult => {
  const queryClient = useQueryClient();
  const authQuery = useAuth();
  const hasGuestCartHydrated = useGuestCartHydration();
  const guestItems = useGuestCartStore((state) => state.items);
  const upsertGuestItem = useGuestCartStore((state) => state.upsertItem);
  const removeGuestItem = useGuestCartStore((state) => state.removeItem);
  const isAuthenticated = Boolean(authQuery.data?.id);

  const serverCartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: fetchCart,
    enabled: isAuthenticated
  });

  const serverUpsertItem = useMutation({
    mutationFn: async (payload: UpsertCartItemInput) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          productId: payload.productId,
          variantId: payload.variantId,
          quantity: payload.quantity,
          customizationId: payload.customizationId ?? null
        })
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

  const serverRemoveItem = useMutation({
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

  const guestUpsertItem = useMemo<MutationLike<UpsertCartItemInput>>(
    () => ({
      isPending: false,
      mutate: (payload, options) => {
        upsertGuestItem(toGuestCartItem(payload));
        void options?.onSuccess?.();
      }
    }),
    [upsertGuestItem]
  );

  const guestRemoveItem = useMemo<MutationLike<string>>(
    () => ({
      isPending: false,
      mutate: (itemId, options) => {
        removeGuestItem(itemId);
        void options?.onSuccess?.();
      }
    }),
    [removeGuestItem]
  );

  if (!isAuthenticated) {
    return {
      data: buildGuestCart(guestItems),
      isLoading: authQuery.isLoading || !hasGuestCartHydrated,
      isError: false,
      isAuthenticated: false,
      upsertItem: guestUpsertItem,
      removeItem: guestRemoveItem
    };
  }

  return {
    data: serverCartQuery.data,
    isError: serverCartQuery.isError,
    isLoading: authQuery.isLoading || serverCartQuery.isLoading,
    isAuthenticated: true,
    upsertItem: {
      isPending: serverUpsertItem.isPending,
      mutate: (payload, options) => {
        serverUpsertItem.mutate(payload, {
          onSuccess: () => {
            void options?.onSuccess?.();
          },
          onError: () => {
            options?.onError?.();
          }
        });
      }
    } satisfies MutationLike<UpsertCartItemInput>,
    removeItem: {
      isPending: serverRemoveItem.isPending,
      mutate: (itemId, options) => {
        serverRemoveItem.mutate(itemId, {
          onSuccess: () => {
            void options?.onSuccess?.();
          },
          onError: () => {
            options?.onError?.();
          }
        });
      }
    } satisfies MutationLike<string>
  };
};
