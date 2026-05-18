import { z } from "zod";

export const profileOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]).optional()
});

export const sessionRevokeSchema = z.object({
  sessionId: z.string().cuid()
});
