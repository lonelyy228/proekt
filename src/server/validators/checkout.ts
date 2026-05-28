import { z } from "zod";

const addressSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  line1: z.string().min(2).max(140),
  line2: z.string().max(140).optional(),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  postalCode: z.string().min(2).max(16),
  country: z.literal("RU")
});

export const checkoutSessionSchema = z.object({
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
});
