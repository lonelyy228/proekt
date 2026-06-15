"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type GuestCartItem = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  currency: string;
  unitPriceCents: number;
  productName: string;
  variantName: string;
  imageUrl?: string | null;
  customizationId?: string | null;
  customizationPreviewUrl?: string | null;
  customizationGarmentType?: string | null;
  customizationColor?: string | null;
};

type GuestCartState = {
  items: GuestCartItem[];
  upsertItem: (item: Omit<GuestCartItem, "id">) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
};

const buildGuestCartItemId = (variantId: string, customizationId?: string | null): string =>
  `guest:${variantId}:${customizationId ?? "standard"}`;

export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set) => ({
      items: [],
      upsertItem: (item) =>
        set((state) => {
          const itemId = buildGuestCartItemId(item.variantId, item.customizationId);
          const existingIndex = state.items.findIndex((current) => current.id === itemId);

          if (existingIndex === -1) {
            return { items: [...state.items, { ...item, id: itemId }] };
          }

          const nextItems = [...state.items];
          nextItems[existingIndex] = {
            ...nextItems[existingIndex],
            ...item,
            id: itemId,
            quantity: item.quantity
          };

          return { items: nextItems };
        }),
      removeItem: (itemId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId)
        })),
      clear: () => set({ items: [] })
    }),
    {
      name: "rsh-guest-cart",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items })
    }
  )
);
