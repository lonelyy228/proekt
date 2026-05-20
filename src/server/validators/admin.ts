import { z } from "zod";

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateOnly = (value: string): boolean => {
  if (!ymdRegex.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};
const dateOnlySchema = z
  .string()
  .regex(ymdRegex, "Дата должна быть в формате YYYY-MM-DD")
  .refine(isValidDateOnly, "Дата календарно некорректна");

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  search: z.string().trim().max(120).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isBlocked: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
});

export const adminUsersExportQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isBlocked: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit: z.coerce.number().int().positive().max(2000).default(1000)
});

export const adminUserUpdateSchema = z
  .object({
    role: z.enum(["USER", "ADMIN"]).optional(),
    isBlocked: z.boolean().optional()
  })
  .refine((value) => value.role !== undefined || value.isBlocked !== undefined, {
    message: "Передайте хотя бы одно поле для обновления",
    path: ["role"]
  });

export const adminUserBulkUpdateSchema = z.object({
  userIds: z.array(z.string().cuid()).min(1).max(100),
  operation: z.enum(["SET_ROLE_ADMIN", "SET_ROLE_USER", "BLOCK", "UNBLOCK"]),
  dryRun: z.boolean().default(false)
});

export const adminUserFilterPresetIdParamsSchema = z.object({
  presetId: z.string().cuid()
});

export const adminUserFilterPresetFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isBlocked: z.boolean().optional()
});

export const adminUserFilterPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: adminUserFilterPresetFiltersSchema.default({}),
  isDefault: z.boolean().default(false)
});

export const adminUserFilterPresetUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    filters: adminUserFilterPresetFiltersSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .refine(
    (value) => value.name !== undefined || value.filters !== undefined || value.isDefault !== undefined,
    {
      message: "Передайте хотя бы одно поле для обновления",
      path: ["name"]
    }
  );

export const adminOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]).optional(),
    dateFrom: dateOnlySchema.optional(),
    dateTo: dateOnlySchema.optional(),
    minTotalCents: z.coerce.number().int().min(0).optional(),
    maxTotalCents: z.coerce.number().int().min(0).optional()
  })
  .refine(
    (value) => {
      if (value.minTotalCents === undefined || value.maxTotalCents === undefined) {
        return true;
      }

      return value.minTotalCents <= value.maxTotalCents;
    },
    {
      message: "minTotalCents не должен быть больше maxTotalCents",
      path: ["minTotalCents"]
    }
  )
  .refine(
    (value) => {
      if (!value.dateFrom || !value.dateTo) {
        return true;
      }

      return value.dateFrom <= value.dateTo;
    },
    {
      message: "dateFrom не должен быть позже dateTo",
      path: ["dateFrom"]
    }
  );

export const adminOrdersCursorQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().max(100).default(40),
    cursor: z.string().cuid().optional(),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]).optional(),
    dateFrom: dateOnlySchema.optional(),
    dateTo: dateOnlySchema.optional(),
    minTotalCents: z.coerce.number().int().min(0).optional(),
    maxTotalCents: z.coerce.number().int().min(0).optional()
  })
  .refine(
    (value) => {
      if (value.minTotalCents === undefined || value.maxTotalCents === undefined) {
        return true;
      }

      return value.minTotalCents <= value.maxTotalCents;
    },
    {
      message: "minTotalCents не должен быть больше maxTotalCents",
      path: ["minTotalCents"]
    }
  )
  .refine(
    (value) => {
      if (!value.dateFrom || !value.dateTo) {
        return true;
      }

      return value.dateFrom <= value.dateTo;
    },
    {
      message: "dateFrom не должен быть позже dateTo",
      path: ["dateFrom"]
    }
  );

export const adminOrderStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"])
});

export const adminOrderIdParamsSchema = z.object({
  orderId: z.string().cuid()
});

export const adminOrdersExportQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]).optional(),
    dateFrom: dateOnlySchema.optional(),
    dateTo: dateOnlySchema.optional(),
    minTotalCents: z.coerce.number().int().min(0).optional(),
    maxTotalCents: z.coerce.number().int().min(0).optional(),
    limit: z.coerce.number().int().positive().max(2000).default(500)
  })
  .refine(
    (value) => {
      if (value.minTotalCents === undefined || value.maxTotalCents === undefined) {
        return true;
      }

      return value.minTotalCents <= value.maxTotalCents;
    },
    {
      message: "minTotalCents не должен быть больше maxTotalCents",
      path: ["minTotalCents"]
    }
  )
  .refine(
    (value) => {
      if (!value.dateFrom || !value.dateTo) {
        return true;
      }

      return value.dateFrom <= value.dateTo;
    },
    {
      message: "dateFrom не должен быть позже dateTo",
      path: ["dateFrom"]
    }
  );

export const adminOrderBulkStatusUpdateSchema = z.object({
  orderIds: z.array(z.string().cuid()).min(1).max(100),
  status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]),
  dryRun: z.boolean().default(false)
});

export const adminProductBulkStatusUpdateSchema = z.object({
  productIds: z.array(z.string().cuid()).min(1).max(100),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  dryRun: z.boolean().default(false)
});

export const adminProductsExportQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().cuid().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  sortBy: z.enum(["newest", "price_asc", "price_desc", "name_asc"]).default("newest"),
  limit: z.coerce.number().int().positive().max(2000).default(1000)
});

export const adminProductFilterPresetIdParamsSchema = z.object({
  presetId: z.string().cuid()
});

export const adminProductFilterPresetFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().cuid().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  sortBy: z.enum(["newest", "price_asc", "price_desc", "name_asc"]).optional()
});

export const adminProductFilterPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: adminProductFilterPresetFiltersSchema.default({}),
  isDefault: z.boolean().default(false)
});

export const adminProductFilterPresetUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    filters: adminProductFilterPresetFiltersSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .refine(
    (value) => value.name !== undefined || value.filters !== undefined || value.isDefault !== undefined,
    {
      message: "Передайте хотя бы одно поле для обновления",
      path: ["name"]
    }
  );

export const adminOrderFilterPresetIdParamsSchema = z.object({
  presetId: z.string().cuid()
});

export const adminOrderFilterPresetFiltersSchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]).optional(),
    dateFrom: dateOnlySchema.optional(),
    dateTo: dateOnlySchema.optional(),
    minTotalCents: z.coerce.number().int().min(0).optional(),
    maxTotalCents: z.coerce.number().int().min(0).optional()
  })
  .refine(
    (value) => {
      if (value.minTotalCents === undefined || value.maxTotalCents === undefined) {
        return true;
      }

      return value.minTotalCents <= value.maxTotalCents;
    },
    {
      message: "minTotalCents не должен быть больше maxTotalCents",
      path: ["minTotalCents"]
    }
  )
  .refine(
    (value) => {
      if (!value.dateFrom || !value.dateTo) {
        return true;
      }

      return value.dateFrom <= value.dateTo;
    },
    {
      message: "dateFrom не должен быть позже dateTo",
      path: ["dateFrom"]
    }
  );

export const adminOrderFilterPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: adminOrderFilterPresetFiltersSchema.default({}),
  isDefault: z.boolean().default(false)
});

export const adminOrderFilterPresetUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    filters: adminOrderFilterPresetFiltersSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .refine(
    (value) => value.name !== undefined || value.filters !== undefined || value.isDefault !== undefined,
    {
      message: "Передайте хотя бы одно поле для обновления",
      path: ["name"]
    }
  );

export const adminAnalyticsQuerySchema = z.object({
  periodDays: z.coerce.number().int().pipe(z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)])).default(30)
});

export const adminSessionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  search: z.string().trim().max(120).optional(),
  userId: z.string().cuid().optional(),
  status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]).optional()
});

export const adminSessionFilterPresetIdParamsSchema = z.object({
  presetId: z.string().cuid()
});

export const adminSessionFilterPresetFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]).optional()
});

export const adminSessionFilterPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: adminSessionFilterPresetFiltersSchema.default({}),
  isDefault: z.boolean().default(false)
});

export const adminSessionFilterPresetUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    filters: adminSessionFilterPresetFiltersSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .refine(
    (value) => value.name !== undefined || value.filters !== undefined || value.isDefault !== undefined,
    {
      message: "Передайте хотя бы одно поле для обновления",
      path: ["name"]
    }
  );

export const adminSessionRevokeSchema = z.object({
  sessionId: z.string().cuid()
});

export const adminSessionBulkRevokeSchema = z
  .object({
    userId: z.string().cuid().optional(),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]).default("ACTIVE"),
    limit: z.coerce.number().int().positive().max(200).default(50),
    dryRun: z.boolean().default(false)
  })
  .refine((value) => Boolean(value.userId || value.search), {
    message: "Укажите userId или search для безопасной массовой операции",
    path: ["userId"]
  });

export const adminWebhookEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  eventType: z.string().trim().min(1).max(120).optional(),
  processed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
});

export const adminWebhookReplaySchema = z.object({
  eventId: z.string().min(5).max(255)
});

export const adminWebhookBulkReplaySchema = z.object({
  eventType: z.string().trim().min(1).max(120).optional(),
  processed: z.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  dryRun: z.boolean().default(false)
});

export const adminWebhookQuickFiltersQuerySchema = z.object({
  limit: z.coerce.number().int().min(3).max(20).default(8),
  eventType: z.string().trim().min(1).max(120).optional(),
  processed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
});

export const adminWebhookExportQuerySchema = z.object({
  eventType: z.string().trim().min(1).max(120).optional(),
  processed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit: z.coerce.number().int().positive().max(2000).default(1000)
});

export const adminWebhookFilterPresetIdParamsSchema = z.object({
  presetId: z.string().cuid()
});

export const adminWebhookFilterPresetFiltersSchema = z.object({
  eventType: z.string().trim().min(1).max(120).optional(),
  processed: z.boolean().optional()
});

export const adminWebhookFilterPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: adminWebhookFilterPresetFiltersSchema.default({}),
  isDefault: z.boolean().default(false)
});

export const adminWebhookFilterPresetUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    filters: adminWebhookFilterPresetFiltersSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .refine(
    (value) => value.name !== undefined || value.filters !== undefined || value.isDefault !== undefined,
    {
      message: "Передайте хотя бы одно поле для обновления",
      path: ["name"]
    }
  );

export const adminLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  action: z.string().trim().min(1).max(120).optional(),
  targetType: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().max(120).optional()
});

export const adminLogsExportQuerySchema = z.object({
  action: z.string().trim().min(1).max(120).optional(),
  targetType: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().positive().max(2000).default(500)
});

export const adminLogsQuickFiltersQuerySchema = z.object({
  limit: z.coerce.number().int().min(3).max(20).default(8),
  action: z.string().trim().min(1).max(120).optional(),
  targetType: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().max(120).optional()
});

export const adminLogFilterPresetIdParamsSchema = z.object({
  presetId: z.string().cuid()
});

export const adminLogFilterPresetFiltersSchema = z.object({
  action: z.string().trim().min(1).max(120).optional(),
  targetType: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().max(120).optional()
});

export const adminLogFilterPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: adminLogFilterPresetFiltersSchema.default({}),
  isDefault: z.boolean().default(false)
});

export const adminLogFilterPresetUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    filters: adminLogFilterPresetFiltersSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .refine(
    (value) => value.name !== undefined || value.filters !== undefined || value.isDefault !== undefined,
    {
      message: "Передайте хотя бы одно поле для обновления",
      path: ["name"]
    }
  );

export const adminContentFilterPresetIdParamsSchema = z.object({
  presetId: z.string().cuid()
});

export const adminContentFilterPresetFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
});

export const adminContentFilterPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: adminContentFilterPresetFiltersSchema.default({}),
  isDefault: z.boolean().default(false)
});

export const adminContentQuickFiltersQuerySchema = z.object({
  search: z.string().trim().max(120).optional()
});

export const adminContentExportQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  limit: z.coerce.number().int().positive().max(2000).default(500)
});

export const adminContentFilterPresetUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    filters: adminContentFilterPresetFiltersSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .refine(
    (value) => value.name !== undefined || value.filters !== undefined || value.isDefault !== undefined,
    {
      message: "Передайте хотя бы одно поле для обновления",
      path: ["name"]
    }
  );
