import { z } from "zod";
import { paginationConfig } from "@/config/constants";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(paginationConfig.defaultPage),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(paginationConfig.maxPageSize)
    .default(paginationConfig.defaultPageSize)
});

export const parsePagination = (searchParams: URLSearchParams): { page: number; pageSize: number; skip: number } => {
  const parsed = querySchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined
  });

  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    skip: (parsed.page - 1) * parsed.pageSize
  };
};
