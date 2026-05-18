import { wishlistRepository } from "@/server/repositories/wishlist-repository";

export const wishlistService = {
  list: (userId: string) => wishlistRepository.listByUserId(userId),

  toggle: async (userId: string, productId: string, variantId?: string) => {
    const existing = await wishlistRepository.findItem(userId, productId, variantId);

    if (existing) {
      await wishlistRepository.deleteItem(existing.id);
      return { added: false };
    }

    await wishlistRepository.createItem(userId, productId, variantId);
    return { added: true };
  }
};
