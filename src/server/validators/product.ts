import { z } from "zod";
import { ProductStatus } from "@prisma/client";

export const productQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  brand: z.string().trim().max(80).optional(),
  scope: z.enum(["ALL", "BRANDED", "BASICS"]).default("BRANDED"),
  minPrice: z.coerce.number().nonnegative().max(50000).optional(),
  maxPrice: z.coerce.number().nonnegative().max(50000).optional(),
  minPriceCents: z.coerce.number().int().nonnegative().optional(),
  maxPriceCents: z.coerce.number().int().nonnegative().optional(),
  sortBy: z.enum(["newest", "price_asc", "price_desc", "name_asc"]).default("newest")
}).refine((value) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined) {
    return value.minPrice <= value.maxPrice;
  }

  if (value.minPriceCents !== undefined && value.maxPriceCents !== undefined) {
    return value.minPriceCents <= value.maxPriceCents;
  }

  return true;
}, "Некорректный диапазон цен");

export const productCreateSchema = z.object({
  brand: z.string().min(2).max(80),
  name: z.string().min(2).max(180),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(20).max(6000),
  shortDescription: z.string().max(280).optional(),
  categoryId: z.string().cuid(),
  basePriceCents: z.number().int().nonnegative(),
  currency: z.literal("USD"),
  tags: z.array(z.string().min(1).max(40)).max(12)
});

export const adminProductListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  search: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().cuid().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  sortBy: z.enum(["newest", "price_asc", "price_desc", "name_asc"]).default("newest")
});

export const productUpdateSchema = z.object({
  brand: z.string().min(2).max(80).optional(),
  name: z.string().min(2).max(180).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().min(20).max(6000).optional(),
  shortDescription: z.string().max(280).nullable().optional(),
  categoryId: z.string().cuid().optional(),
  basePriceCents: z.number().int().nonnegative().optional(),
  currency: z.literal("USD").optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional()
});
