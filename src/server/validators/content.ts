import { z } from "zod";

export const contentCreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(2).max(180),
  content: z.string().min(10).max(20000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT")
});

export const contentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
});

export const contentUpdateSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    title: z.string().min(2).max(180).optional(),
    content: z.string().min(10).max(20000).optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
  })
  .refine(
    (value) =>
      value.slug !== undefined ||
      value.title !== undefined ||
      value.content !== undefined ||
      value.status !== undefined,
    {
      message: "Передайте хотя бы одно поле для обновления",
      path: ["title"]
    }
  );

export const contentBulkStatusUpdateSchema = z.object({
  postIds: z.array(z.string().cuid()).min(1).max(100),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  dryRun: z.boolean().default(false)
});

export const contentPostIdParamsSchema = z.object({
  postId: z.string().cuid()
});
