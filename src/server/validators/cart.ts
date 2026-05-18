import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid(),
  quantity: z.number().int().positive().max(50),
  customizationId: z.string().cuid().nullable().optional()
});

export const cartMergeSchema = z.object({
  guestItems: z.array(cartItemSchema).max(100)
});
