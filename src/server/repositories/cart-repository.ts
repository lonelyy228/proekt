import { prisma } from "@/lib/prisma";

export const cartRepository = {
  findByUserId: (userId: string) =>
    prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
            customization: true
          }
        }
      }
    }),

  upsertCart: (userId: string) =>
    prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {}
    }),

  upsertItem: (data: {
    cartId: string;
    productId: string;
    variantId: string;
    quantity: number;
    customizationId?: string | null;
  }) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findFirst({
        where: {
          cartId: data.cartId,
          variantId: data.variantId,
          customizationId: data.customizationId ?? null
        }
      });

      if (existing) {
        return tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: data.quantity }
        });
      }

      return tx.cartItem.create({
        data: {
          cartId: data.cartId,
          productId: data.productId,
          variantId: data.variantId,
          quantity: data.quantity,
          customizationId: data.customizationId ?? null
        }
      });
    }),

  removeItem: (itemId: string) => prisma.cartItem.delete({ where: { id: itemId } }),
  clearByUserId: (userId: string) =>
    prisma.cartItem.deleteMany({
      where: {
        cart: {
          userId
        }
      }
    })
};
