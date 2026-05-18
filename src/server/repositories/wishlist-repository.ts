import { prisma } from "@/lib/prisma";

export const wishlistRepository = {
  listByUserId: (userId: string) =>
    prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: {
              orderBy: { sortOrder: "asc" },
              take: 1
            }
          }
        },
        variant: true
      },
      orderBy: { createdAt: "desc" }
    }),

  findItem: (userId: string, productId: string, variantId?: string) =>
    prisma.wishlistItem.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId ?? null
      }
    }),

  createItem: (userId: string, productId: string, variantId?: string) =>
    prisma.wishlistItem.create({
      data: {
        userId,
        productId,
        variantId: variantId ?? null
      }
    }),

  deleteItem: (id: string) => prisma.wishlistItem.delete({ where: { id } })
};
