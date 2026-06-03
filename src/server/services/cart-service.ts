import { cartRepository } from "@/server/repositories/cart-repository";
import { designRepository } from "@/server/repositories/design-repository";
import { productRepository } from "@/server/repositories/product-repository";
import { isCustomizerBaseBrand, CUSTOMIZER_BRAND_RESTRICTION_MESSAGE } from "@/config/customizer";
import { AppError } from "@/server/utils/errors";

const MAX_CART_ITEM_QUANTITY = 50;

const validateCartItemReferences = async (userId: string, payload: { productId: string; variantId: string; customizationId?: string | null }) => {
  const [product, variant] = await Promise.all([
    productRepository.findById(payload.productId),
    productRepository.findVariantById(payload.variantId)
  ]);

  if (!product) {
    throw new AppError("NOT_FOUND", "Product not found");
  }

  if (!variant || variant.productId !== product.id) {
    throw new AppError("VALIDATION_ERROR", "Variant does not belong to the selected product");
  }

  if (!payload.customizationId) {
    return;
  }

  if (!isCustomizerBaseBrand(product.brand)) {
    throw new AppError("FORBIDDEN", CUSTOMIZER_BRAND_RESTRICTION_MESSAGE);
  }

  const design = await designRepository.findById(payload.customizationId, userId);

  if (!design) {
    throw new AppError("NOT_FOUND", "Customization design not found");
  }
};

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
        currency: item.variant.currency,
        unitPriceCents,
        totalPriceCents: item.quantity * unitPriceCents,
        productName: item.product.name,
        variantName: item.variant.name,
        imageUrl: item.product.shortDescription,
        customizationPreviewUrl: item.customization?.previewUrl ?? null,
        customizationGarmentType: item.customization?.garmentType ?? null,
        customizationColor: item.customization?.garmentColor ?? null
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

    if (payload.quantity > MAX_CART_ITEM_QUANTITY) {
      throw new AppError("VALIDATION_ERROR", `Quantity cannot exceed ${MAX_CART_ITEM_QUANTITY}`);
    }

    await validateCartItemReferences(userId, payload);

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
