import { z } from "zod";

export const wishlistToggleSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional()
});
