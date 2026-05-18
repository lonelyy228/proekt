"use client";

import { create } from "zustand";

type GuestCartItem = {
  productId: string;
  variantId: string;
  quantity: number;
  customizationId?: string | null;
};

type GuestCartState = {
  items: GuestCartItem[];
  upsertItem: (item: GuestCartItem) => void;
  removeItem: (variantId: string, customizationId?: string | null) => void;
  clear: () => void;
};

export const useGuestCartStore = create<GuestCartState>((set) => ({
  items: [],
  upsertItem: (item) =>
    set((state) => {
      const existingIndex = state.items.findIndex(
        (current) =>
          current.variantId === item.variantId && (current.customizationId ?? null) === (item.customizationId ?? null)
      );

      if (existingIndex === -1) {
        return { items: [...state.items, item] };
      }

      const nextItems = [...state.items];
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        quantity: item.quantity
      };

      return { items: nextItems };
    }),
  removeItem: (variantId, customizationId) =>
    set((state) => ({
      items: state.items.filter(
        (item) => !(item.variantId === variantId && (item.customizationId ?? null) === (customizationId ?? null))
      )
    })),
  clear: () => set({ items: [] })
}));
