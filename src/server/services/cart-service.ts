import { cartRepository } from "@/server/repositories/cart-repository";
import { designRepository } from "@/server/repositories/design-repository";
import { productRepository } from "@/server/repositories/product-repository";
import { AppError } from "@/server/utils/errors";
import {
  extractCustomizerGarmentTypesFromTags,
  isCustomizerBaseBrand
} from "@/config/customizer";

export const cartService = {
  getCart: async (userId: string) => {
    const cart = await cartRepository.upsertCart(userId);
    const fullCart = await cartRepository.findByUserId(userId);

    if (!fullCart) {
      return {
        id: cart.id,
        items: [],
        subtotalCents: 0
      };
    }

    const items = fullCart.items.map((item) => {
      const unitPriceCents = item.variant.priceCents;
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        customizationId: item.customizationId,
        unitPriceCents,
        totalPriceCents: item.quantity * unitPriceCents,
        productName: item.product.name,
        variantName: item.variant.name,
        imageUrl: item.product.shortDescription
      };
    });

    const subtotalCents = items.reduce((sum, item) => sum + item.totalPriceCents, 0);

    return {
      id: fullCart.id,
      items,
      subtotalCents
    };
  },

  upsertItem: async (userId: string, payload: { productId: string; variantId: string; quantity: number; customizationId?: string | null }) => {
    const cart = await cartRepository.upsertCart(userId);

    if (payload.quantity <= 0) {
      throw new AppError("VALIDATION_ERROR", "Quantity must be greater than zero");
    }

    const productVariant = await productRepository.findVariantForCartInput({
      productId: payload.productId,
      variantId: payload.variantId
    });

    if (!productVariant) {
      throw new AppError("NOT_FOUND", "Товар или вариант не найдены");
    }

    if (payload.customizationId) {
      if (!isCustomizerBaseBrand(productVariant.product.brand)) {
        throw new AppError(
          "FORBIDDEN",
          "Кастомизация доступна только для базовой линейки RSH Basics. Брендовые вещи не кастомизируются."
        );
      }

      const design = await designRepository.findById(payload.customizationId, userId);
      if (!design) {
        throw new AppError("NOT_FOUND", "Дизайн не найден или недоступен");
      }

      const allowedGarments = extractCustomizerGarmentTypesFromTags(productVariant.product.tags);
      if (allowedGarments.length > 0 && !allowedGarments.includes(design.garmentType)) {
        throw new AppError(
          "CONFLICT",
          "Тип дизайна не совпадает с типом выбранной базовой вещи"
        );
      }
    }

    await cartRepository.upsertItem({
      cartId: cart.id,
      productId: payload.productId,
      variantId: payload.variantId,
      quantity: payload.quantity,
      customizationId: payload.customizationId ?? null
    });

    return cartService.getCart(userId);
  },

  removeItem: async (userId: string, itemId: string) => {
    await cartRepository.removeItem(itemId);
    return cartService.getCart(userId);
  },

  mergeGuestCart: async (
    userId: string,
    guestItems: Array<{ productId: string; variantId: string; quantity: number; customizationId?: string | null }>
  ) => {
    const currentCart = await cartService.getCart(userId);

    for (const guestItem of guestItems) {
      const match = currentCart.items.find(
        (existing) =>
          existing.variantId === guestItem.variantId &&
          (existing.customizationId ?? null) === (guestItem.customizationId ?? null)
      );

      const mergedQuantity = Math.min(50, (match?.quantity ?? 0) + guestItem.quantity);

      await cartService.upsertItem(userId, {
        productId: guestItem.productId,
        variantId: guestItem.variantId,
        quantity: mergedQuantity,
        customizationId: guestItem.customizationId ?? null
      });
    }

    return cartService.getCart(userId);
  }
};
