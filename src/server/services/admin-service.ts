import { orderRepository } from "@/server/repositories/order-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { adminOrderFilterPresetRepository } from "@/server/repositories/admin-order-filter-preset-repository";
import { adminUserFilterPresetRepository } from "@/server/repositories/admin-user-filter-preset-repository";
import { adminProductFilterPresetRepository } from "@/server/repositories/admin-product-filter-preset-repository";
import { auditRepository } from "@/server/repositories/audit-repository";
import { productRepository } from "@/server/repositories/product-repository";
import { contentRepository } from "@/server/repositories/content-repository";
import { productService } from "@/server/services/product-service";
import { sessionRepository } from "@/server/repositories/session-repository";
import { refreshTokenRepository } from "@/server/repositories/refresh-token-repository";
import { stripeEventRepository } from "@/server/repositories/stripe-event-repository";
import { checkoutService } from "@/server/services/checkout-service";
import { AppError } from "@/server/utils/errors";
import { buildCsv } from "@/server/utils/csv";
import { OrderStatus, PaymentStatus, Prisma, ProductStatus, Role } from "@prisma/client";

const toUtcDayStart = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const calculateDeltaPercent = (current: number, previous: number): number => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 10000) / 100;
};

const allowedOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CANCELLED, OrderStatus.PAID],
  PAID: [OrderStatus.FULFILLED, OrderStatus.REFUNDED],
  FULFILLED: [OrderStatus.REFUNDED],
  CANCELLED: [],
  REFUNDED: []
};

const extractStringFromDetails = (details: unknown, key: string): string | null => {
  if (!details || typeof details !== "object") {
    return null;
  }

  const maybeValue = (details as Record<string, unknown>)[key];
  if (typeof maybeValue !== "string") {
    return null;
  }

  return maybeValue;
};

const parseDateRange = (params: { dateFrom?: string; dateTo?: string }): {
  dateFrom?: Date;
  dateToExclusive?: Date;
} => {
  const dateFrom = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00.000Z`) : undefined;
  const dateToExclusive = params.dateTo ? new Date(`${params.dateTo}T00:00:00.000Z`) : undefined;

  if (dateToExclusive) {
    dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1);
  }

  return { dateFrom, dateToExclusive };
};

const normalizeOrderFilterPresetFilters = (filters: {
  search?: string;
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  minTotalCents?: number;
  maxTotalCents?: number;
}) => ({
  search: filters.search?.trim() ? filters.search.trim() : undefined,
  status: filters.status,
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
  minTotalCents: filters.minTotalCents,
  maxTotalCents: filters.maxTotalCents
});

const mapOrderFilterPreset = (preset: {
  id: string;
  name: string;
  search: string | null;
  status: OrderStatus | null;
  dateFrom: string | null;
  dateTo: string | null;
  minTotalCents: number | null;
  maxTotalCents: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: preset.id,
  name: preset.name,
  isDefault: preset.isDefault,
  createdAt: preset.createdAt,
  updatedAt: preset.updatedAt,
  filters: {
    search: preset.search ?? undefined,
    status: preset.status ?? undefined,
    dateFrom: preset.dateFrom ?? undefined,
    dateTo: preset.dateTo ?? undefined,
    minTotalCents: preset.minTotalCents ?? undefined,
    maxTotalCents: preset.maxTotalCents ?? undefined
  }
});

const normalizeUserFilterPresetFilters = (filters: {
  search?: string;
  role?: Role;
  isBlocked?: boolean;
}) => ({
  search: filters.search?.trim() ? filters.search.trim() : undefined,
  role: filters.role,
  isBlocked: filters.isBlocked
});

const mapUserFilterPreset = (preset: {
  id: string;
  name: string;
  search: string | null;
  role: Role | null;
  isBlocked: boolean | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: preset.id,
  name: preset.name,
  isDefault: preset.isDefault,
  createdAt: preset.createdAt,
  updatedAt: preset.updatedAt,
  filters: {
    search: preset.search ?? undefined,
    role: preset.role ?? undefined,
    isBlocked: preset.isBlocked ?? undefined
  }
});

const normalizeProductFilterPresetFilters = (filters: {
  search?: string;
  brand?: string;
  categoryId?: string;
  status?: ProductStatus;
  sortBy?: "newest" | "price_asc" | "price_desc" | "name_asc";
}) => ({
  search: filters.search?.trim() ? filters.search.trim() : undefined,
  brand: filters.brand?.trim() ? filters.brand.trim() : undefined,
  categoryId: filters.categoryId,
  status: filters.status,
  sortBy: filters.sortBy
});

const mapProductFilterPreset = (preset: {
  id: string;
  name: string;
  search: string | null;
  brand: string | null;
  categoryId: string | null;
  status: ProductStatus | null;
  sortBy: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: preset.id,
  name: preset.name,
  isDefault: preset.isDefault,
  createdAt: preset.createdAt,
  updatedAt: preset.updatedAt,
  filters: {
    search: preset.search ?? undefined,
    brand: preset.brand ?? undefined,
    categoryId: preset.categoryId ?? undefined,
    status: preset.status ?? undefined,
    sortBy:
      preset.sortBy === "newest" ||
      preset.sortBy === "price_asc" ||
      preset.sortBy === "price_desc" ||
      preset.sortBy === "name_asc"
        ? preset.sortBy
        : undefined
  }
});

const isPrismaUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

const getStatusTransitionRejectionReason = (
  order: { status: OrderStatus; payments: Array<{ status: PaymentStatus }> },
  nextStatus: OrderStatus
): string | null => {
  if (order.status === nextStatus) {
    return "Заказ уже имеет этот статус";
  }

  const allowed = allowedOrderTransitions[order.status];
  if (!allowed.includes(nextStatus)) {
    return `Нельзя изменить статус с ${order.status} на ${nextStatus}`;
  }

  if (nextStatus === OrderStatus.PAID || nextStatus === OrderStatus.REFUNDED) {
    const hasSucceededPayment = order.payments.some(
      (payment) => payment.status === PaymentStatus.SUCCEEDED
    );
    if (!hasSucceededPayment) {
      return nextStatus === OrderStatus.PAID
        ? "Нельзя вручную перевести заказ в PAID без успешной оплаты"
        : "Нельзя оформить возврат без успешной оплаты";
    }
  }

  return null;
};

export const adminService = {
  dashboard: async () => {
    const [orderCount, usersCount] = await Promise.all([
      orderRepository.countOrders(),
      userRepository.countUsers({})
    ]);

    return {
      orderCount,
      usersCount
    };
  },

  dashboardOverview: async () => {
    const [
      totalUsers,
      blockedUsers,
      totalProducts,
      activeProducts,
      archivedProducts,
      totalOrders,
      pendingOrders,
      paidOrders,
      fulfilledOrders,
      totalPosts,
      publishedPosts,
      activeSessions,
      pendingWebhookEvents
    ] = await Promise.all([
      userRepository.countUsers({}),
      userRepository.countUsers({ isBlocked: true }),
      productRepository.countAdminProducts({}),
      productRepository.countAdminProducts({ status: ProductStatus.ACTIVE }),
      productRepository.countAdminProducts({ status: ProductStatus.ARCHIVED }),
      orderRepository.countOrders(),
      orderRepository.countOrders({ status: OrderStatus.PENDING }),
      orderRepository.countOrders({ status: OrderStatus.PAID }),
      orderRepository.countOrders({ status: OrderStatus.FULFILLED }),
      contentRepository.count({}),
      contentRepository.count({ status: "PUBLISHED" }),
      sessionRepository.countAdminSessions({ status: "ACTIVE" }),
      stripeEventRepository.countPaginated({ processed: false })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      kpis: {
        totalUsers,
        blockedUsers,
        totalProducts,
        activeProducts,
        archivedProducts,
        totalOrders,
        pendingOrders,
        paidOrders,
        fulfilledOrders,
        totalPosts,
        publishedPosts,
        activeSessions,
        pendingWebhookEvents
      },
      health: {
        hasOrderBacklog: pendingOrders > 50,
        hasWebhookBacklog: pendingWebhookEvents > 25,
        hasBlockedUsersSpike:
          totalUsers > 0 ? Math.round((blockedUsers / totalUsers) * 10000) / 100 > 5 : false
      }
    };
  },

  analytics: async (periodDays: 7 | 14 | 30 | 90) => {
    const now = new Date();
    const todayUtcStart = toUtcDayStart(now);
    const periodEnd = addUtcDays(todayUtcStart, 1);
    const periodStart = addUtcDays(periodEnd, -periodDays);
    const previousPeriodStart = addUtcDays(periodStart, -periodDays);

    const [
      totalOrders,
      paidOrders,
      revenueCents,
      newUsers,
      previousTotalOrders,
      previousPaidOrders,
      previousRevenueCents,
      previousNewUsers,
      daily
    ] = await Promise.all([
      orderRepository.countOrdersInRange({ start: periodStart, end: periodEnd }),
      orderRepository.countPaidOrdersInRange({ start: periodStart, end: periodEnd }),
      orderRepository.sumPaidRevenueInRange({ start: periodStart, end: periodEnd }),
      userRepository.countUsersInRange({ start: periodStart, end: periodEnd }),
      orderRepository.countOrdersInRange({ start: previousPeriodStart, end: periodStart }),
      orderRepository.countPaidOrdersInRange({ start: previousPeriodStart, end: periodStart }),
      orderRepository.sumPaidRevenueInRange({ start: previousPeriodStart, end: periodStart }),
      userRepository.countUsersInRange({ start: previousPeriodStart, end: periodStart }),
      orderRepository.dailyOrdersAggregate({ start: periodStart, end: periodEnd })
    ]);

    const paidRatePercent = totalOrders === 0 ? 0 : Math.round((paidOrders / totalOrders) * 10000) / 100;
    const aovCents = paidOrders === 0 ? 0 : Math.round(revenueCents / paidOrders);
    const previousPaidRatePercent =
      previousTotalOrders === 0 ? 0 : Math.round((previousPaidOrders / previousTotalOrders) * 10000) / 100;
    const previousAovCents = previousPaidOrders === 0 ? 0 : Math.round(previousRevenueCents / previousPaidOrders);

    return {
      period: {
        days: periodDays,
        startDate: periodStart.toISOString(),
        endDateExclusive: periodEnd.toISOString()
      },
      metrics: {
        totalOrders: {
          current: totalOrders,
          previous: previousTotalOrders,
          deltaPercent: calculateDeltaPercent(totalOrders, previousTotalOrders)
        },
        paidOrders: {
          current: paidOrders,
          previous: previousPaidOrders,
          deltaPercent: calculateDeltaPercent(paidOrders, previousPaidOrders)
        },
        revenueCents: {
          current: revenueCents,
          previous: previousRevenueCents,
          deltaPercent: calculateDeltaPercent(revenueCents, previousRevenueCents)
        },
        aovCents: {
          current: aovCents,
          previous: previousAovCents,
          deltaPercent: calculateDeltaPercent(aovCents, previousAovCents)
        },
        paidRatePercent: {
          current: paidRatePercent,
          previous: previousPaidRatePercent,
          deltaPercent: calculateDeltaPercent(paidRatePercent, previousPaidRatePercent)
        },
        newUsers: {
          current: newUsers,
          previous: previousNewUsers,
          deltaPercent: calculateDeltaPercent(newUsers, previousNewUsers)
        }
      },
      daily
    };
  },

  listUsers: async (params: {
    page: number;
    pageSize: number;
    search?: string;
    role?: "USER" | "ADMIN";
    isBlocked?: boolean;
  }) => {
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      userRepository.listUsers({
        skip,
        take: params.pageSize,
        search: params.search,
        role: params.role,
        isBlocked: params.isBlocked
      }),
      userRepository.countUsers({
        search: params.search,
        role: params.role,
        isBlocked: params.isBlocked
      })
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  updateUserAccess: async (
    adminId: string,
    targetUserId: string,
    payload: {
      role?: "USER" | "ADMIN";
      isBlocked?: boolean;
    }
  ) => {
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new AppError("NOT_FOUND", "Пользователь не найден");
    }

    if (target.id === adminId && payload.isBlocked === true) {
      throw new AppError("FORBIDDEN", "Нельзя заблокировать собственный аккаунт");
    }

    if (target.id === adminId && payload.role && payload.role !== target.role) {
      throw new AppError("FORBIDDEN", "Нельзя менять собственную роль");
    }

    const demotingAdmin = target.role === Role.ADMIN && target.isBlocked === false && payload.role === Role.USER;
    const blockingAdmin = target.role === Role.ADMIN && target.isBlocked === false && payload.isBlocked === true;

    if (demotingAdmin || blockingAdmin) {
      const activeAdmins = await userRepository.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new AppError("CONFLICT", "Нельзя отключить последнего активного администратора");
      }
    }

    const updated = await userRepository.updateUserAdminFields(target.id, {
      role: payload.role,
      isBlocked: payload.isBlocked
    });

    if (payload.isBlocked === true && target.isBlocked === false) {
      await Promise.all([
        sessionRepository.revokeActiveByUserIdExcept(target.id),
        refreshTokenRepository.revokeByUserIdExceptSession(target.id)
      ]);
    }

    const auditTasks: Array<Promise<unknown>> = [];

    if (payload.role && payload.role !== target.role) {
      auditTasks.push(
        auditRepository.logAdminAction({
          adminId,
          action: "USER_ROLE_CHANGE",
          targetType: "USER",
          targetId: target.id,
          details: {
            fromRole: target.role,
            toRole: payload.role
          }
        })
      );
    }

    if (payload.isBlocked !== undefined && payload.isBlocked !== target.isBlocked) {
      auditTasks.push(
        auditRepository.logAdminAction({
          adminId,
          action: payload.isBlocked ? "USER_BLOCK" : "USER_UNBLOCK",
          targetType: "USER",
          targetId: target.id,
          details: {
            fromBlocked: target.isBlocked,
            toBlocked: payload.isBlocked
          }
        })
      );
    }

    if (auditTasks.length > 0) {
      await Promise.all(auditTasks);
    }

    return updated;
  },

  updateUsersAccessBulk: async (
    adminId: string,
    params: {
      userIds: string[];
      operation: "SET_ROLE_ADMIN" | "SET_ROLE_USER" | "BLOCK" | "UNBLOCK";
      dryRun: boolean;
    }
  ) => {
    const uniqueUserIds = Array.from(new Set(params.userIds));
    const users = await userRepository.findUsersByIdsForAdmin(uniqueUserIds);
    const foundIds = new Set(users.map((user) => user.id));
    const missingUserIds = uniqueUserIds.filter((userId) => !foundIds.has(userId));
    if (missingUserIds.length > 0) {
      throw new AppError("NOT_FOUND", `Не найдены пользователи: ${missingUserIds.join(", ")}`);
    }

    const operationLabelByCode: Record<typeof params.operation, string> = {
      SET_ROLE_ADMIN: "назначение роли ADMIN",
      SET_ROLE_USER: "назначение роли USER",
      BLOCK: "блокировка",
      UNBLOCK: "разблокировка"
    };

    const preliminary = users.map((user) => {
      if (user.id === adminId) {
        return {
          userId: user.id,
          canUpdate: false as const,
          reason: "Нельзя выполнять bulk-операцию над своим аккаунтом",
          fromRole: user.role,
          toRole: user.role,
          fromBlocked: user.isBlocked,
          toBlocked: user.isBlocked
        };
      }

      if (params.operation === "SET_ROLE_ADMIN") {
        if (user.role === Role.ADMIN) {
          return {
            userId: user.id,
            canUpdate: false as const,
            reason: "Пользователь уже имеет роль ADMIN",
            fromRole: user.role,
            toRole: user.role,
            fromBlocked: user.isBlocked,
            toBlocked: user.isBlocked
          };
        }

        return {
          userId: user.id,
          canUpdate: true as const,
          reason: null,
          fromRole: user.role,
          toRole: Role.ADMIN,
          fromBlocked: user.isBlocked,
          toBlocked: user.isBlocked
        };
      }

      if (params.operation === "SET_ROLE_USER") {
        if (user.role === Role.USER) {
          return {
            userId: user.id,
            canUpdate: false as const,
            reason: "Пользователь уже имеет роль USER",
            fromRole: user.role,
            toRole: user.role,
            fromBlocked: user.isBlocked,
            toBlocked: user.isBlocked
          };
        }

        return {
          userId: user.id,
          canUpdate: true as const,
          reason: null,
          fromRole: user.role,
          toRole: Role.USER,
          fromBlocked: user.isBlocked,
          toBlocked: user.isBlocked
        };
      }

      if (params.operation === "BLOCK") {
        if (user.isBlocked) {
          return {
            userId: user.id,
            canUpdate: false as const,
            reason: "Пользователь уже заблокирован",
            fromRole: user.role,
            toRole: user.role,
            fromBlocked: user.isBlocked,
            toBlocked: user.isBlocked
          };
        }

        return {
          userId: user.id,
          canUpdate: true as const,
          reason: null,
          fromRole: user.role,
          toRole: user.role,
          fromBlocked: user.isBlocked,
          toBlocked: true
        };
      }

      if (!user.isBlocked) {
        return {
          userId: user.id,
          canUpdate: false as const,
          reason: "Пользователь уже активен",
          fromRole: user.role,
          toRole: user.role,
          fromBlocked: user.isBlocked,
          toBlocked: user.isBlocked
        };
      }

      return {
        userId: user.id,
        canUpdate: true as const,
        reason: null,
        fromRole: user.role,
        toRole: user.role,
        fromBlocked: user.isBlocked,
        toBlocked: false
      };
    });

    const eligible: Array<(typeof preliminary)[number]> = preliminary.filter((item) => item.canUpdate);
    const rejected: Array<(typeof preliminary)[number]> = preliminary.filter((item) => !item.canUpdate);

    const affectsActiveAdmin = (item: (typeof eligible)[number]): boolean =>
      item.fromRole === Role.ADMIN &&
      item.fromBlocked === false &&
      ((item.toRole === Role.USER && item.toBlocked === false) || item.toBlocked === true);

    const activeAdmins = await userRepository.countActiveAdmins();
    const activeAdminCandidates = eligible.filter((item) => affectsActiveAdmin(item));
    const maxAllowedAdminDisables = Math.max(0, activeAdmins - 1);

    if (activeAdminCandidates.length > maxAllowedAdminDisables) {
      const allowedIds = new Set(activeAdminCandidates.slice(0, maxAllowedAdminDisables).map((item) => item.userId));

      for (const candidate of activeAdminCandidates) {
        if (allowedIds.has(candidate.userId)) {
          continue;
        }

        const index = eligible.findIndex((item) => item.userId === candidate.userId);
        if (index >= 0) {
          const [removed] = eligible.splice(index, 1);
          rejected.push({
            ...removed,
            canUpdate: false as const,
            reason: "Нельзя отключить последнего активного администратора"
          });
        }
      }
    }

    if (params.dryRun) {
      return {
        dryRun: true,
        operation: params.operation,
        operationLabel: operationLabelByCode[params.operation],
        requestedCount: uniqueUserIds.length,
        eligibleCount: eligible.length,
        rejectedCount: rejected.length,
        eligible,
        rejected
      };
    }

    if (eligible.length === 0) {
      throw new AppError("CONFLICT", "Нет пользователей, подходящих для выбранной bulk-операции");
    }

    const eligibleUserIds = eligible.map((item) => item.userId);
    if (params.operation === "SET_ROLE_ADMIN") {
      await userRepository.updateUsersAdminFieldsByIds(eligibleUserIds, {
        role: Role.ADMIN
      });
    } else if (params.operation === "SET_ROLE_USER") {
      await userRepository.updateUsersAdminFieldsByIds(eligibleUserIds, {
        role: Role.USER
      });
    } else if (params.operation === "BLOCK") {
      await userRepository.updateUsersAdminFieldsByIds(eligibleUserIds, {
        isBlocked: true
      });
      await Promise.all(
        eligibleUserIds.map((userId) =>
          Promise.all([
            sessionRepository.revokeActiveByUserIdExcept(userId),
            refreshTokenRepository.revokeByUserIdExceptSession(userId)
          ])
        )
      );
    } else {
      await userRepository.updateUsersAdminFieldsByIds(eligibleUserIds, {
        isBlocked: false
      });
    }

    await Promise.all(
      eligible.map((item) => {
        if (item.fromRole !== item.toRole) {
          return auditRepository.logAdminAction({
            adminId,
            action: "USER_ROLE_CHANGE",
            targetType: "USER",
            targetId: item.userId,
            details: {
              fromRole: item.fromRole,
              toRole: item.toRole,
              source: "bulk"
            }
          });
        }

        if (item.fromBlocked !== item.toBlocked) {
          return auditRepository.logAdminAction({
            adminId,
            action: item.toBlocked ? "USER_BLOCK" : "USER_UNBLOCK",
            targetType: "USER",
            targetId: item.userId,
            details: {
              fromBlocked: item.fromBlocked,
              toBlocked: item.toBlocked,
              source: "bulk"
            }
          });
        }

        return Promise.resolve();
      })
    );

    await auditRepository.logAdminAction({
      adminId,
      action: "USER_BULK_UPDATE",
      targetType: "USER",
      targetId: "bulk",
      details: {
        operation: params.operation,
        requestedCount: uniqueUserIds.length,
        updatedCount: eligible.length,
        rejectedCount: rejected.length
      }
    });

    return {
      dryRun: false,
      operation: params.operation,
      operationLabel: operationLabelByCode[params.operation],
      requestedCount: uniqueUserIds.length,
      updatedCount: eligible.length,
      rejectedCount: rejected.length,
      updatedUserIds: eligibleUserIds,
      rejected
    };
  },

  listUserFilterPresets: async (adminId: string) => {
    const presets = await adminUserFilterPresetRepository.listByAdminId(adminId);
    return presets.map((preset) => mapUserFilterPreset(preset));
  },

  createUserFilterPreset: async (
    adminId: string,
    payload: {
      name: string;
      filters: {
        search?: string;
        role?: Role;
        isBlocked?: boolean;
      };
      isDefault: boolean;
    }
  ) => {
    try {
      const created = await adminUserFilterPresetRepository.create({
        adminId,
        name: payload.name.trim(),
        filters: normalizeUserFilterPresetFilters(payload.filters),
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "USER_FILTER_PRESET_CREATE",
        targetType: "USER_FILTER_PRESET",
        targetId: created.id,
        details: {
          name: created.name,
          isDefault: created.isDefault
        }
      });

      return mapUserFilterPreset(created);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  updateUserFilterPreset: async (
    adminId: string,
    presetId: string,
    payload: {
      name?: string;
      filters?: {
        search?: string;
        role?: Role;
        isBlocked?: boolean;
      };
      isDefault?: boolean;
    }
  ) => {
    const existing = await adminUserFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    try {
      const updated = await adminUserFilterPresetRepository.update({
        adminId,
        presetId,
        name: payload.name?.trim(),
        filters: payload.filters ? normalizeUserFilterPresetFilters(payload.filters) : undefined,
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "USER_FILTER_PRESET_UPDATE",
        targetType: "USER_FILTER_PRESET",
        targetId: updated.id,
        details: {
          beforeName: existing.name,
          afterName: updated.name,
          beforeIsDefault: existing.isDefault,
          afterIsDefault: updated.isDefault
        }
      });

      return mapUserFilterPreset(updated);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  deleteUserFilterPreset: async (adminId: string, presetId: string) => {
    const existing = await adminUserFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    await adminUserFilterPresetRepository.removeById(adminId, presetId);
    await auditRepository.logAdminAction({
      adminId,
      action: "USER_FILTER_PRESET_DELETE",
      targetType: "USER_FILTER_PRESET",
      targetId: presetId,
      details: {
        name: existing.name,
        isDefault: existing.isDefault
      }
    });

    return {
      deleted: true
    };
  },

  createProduct: async (
    adminId: string,
    payload: {
      brand: string;
      name: string;
      slug: string;
      description: string;
      shortDescription?: string;
      categoryId: string;
      basePriceCents: number;
      currency: "USD";
      tags: string[];
    }
  ) => {
    const product = await productService.createAdminProduct(payload);

    await auditRepository.logAdminAction({
      adminId,
      action: "PRODUCT_CREATE",
      targetType: "PRODUCT",
      targetId: product.id,
      details: {
        slug: product.slug
      }
    });

    return product;
  },

  listProducts: async (params: {
    page: number;
    pageSize: number;
    search?: string;
    brand?: string;
    categoryId?: string;
    status?: ProductStatus;
    sortBy: "newest" | "price_asc" | "price_desc" | "name_asc";
  }) => productService.listAdminProducts(params),

  listProductCategories: async () => productService.listCategories(),

  updateProduct: async (
    adminId: string,
    productId: string,
    payload: {
      brand?: string;
      name?: string;
      slug?: string;
      description?: string;
      shortDescription?: string | null;
      categoryId?: string;
      basePriceCents?: number;
      currency?: "USD";
      status?: ProductStatus;
      tags?: string[];
    }
  ) => {
    const result = await productService.updateAdminProductById(productId, payload);

    await auditRepository.logAdminAction({
      adminId,
      action: "PRODUCT_UPDATE",
      targetType: "PRODUCT",
      targetId: productId,
      details: {
        beforeSlug: result.before.slug,
        afterSlug: result.after.slug
      }
    });

    return result.after;
  },

  deleteProduct: async (adminId: string, productId: string) => {
    const deleted = await productService.deleteAdminProductById(productId);

    await auditRepository.logAdminAction({
      adminId,
      action: "PRODUCT_DELETE",
      targetType: "PRODUCT",
      targetId: productId,
      details: {
        slug: deleted.slug
      }
    });

    return { deleted: true };
  },

  updateProductsStatusBulk: async (
    adminId: string,
    params: {
      productIds: string[];
      status: ProductStatus;
      dryRun: boolean;
    }
  ) => {
    const uniqueProductIds = Array.from(new Set(params.productIds));
    const products = await productRepository.findProductsByIdsForAdmin(uniqueProductIds);
    const foundIds = new Set(products.map((product) => product.id));
    const missingIds = uniqueProductIds.filter((productId) => !foundIds.has(productId));
    if (missingIds.length > 0) {
      throw new AppError("NOT_FOUND", `Не найдены товары: ${missingIds.join(", ")}`);
    }

    const evaluated = products.map((product) => {
      if (product.status === params.status) {
        return {
          productId: product.id,
          fromStatus: product.status,
          toStatus: params.status,
          canUpdate: false as const,
          reason: "Товар уже имеет выбранный статус"
        };
      }

      return {
        productId: product.id,
        fromStatus: product.status,
        toStatus: params.status,
        canUpdate: true as const,
        reason: null
      };
    });

    const eligible = evaluated.filter((item) => item.canUpdate);
    const rejected = evaluated.filter((item) => !item.canUpdate);

    if (params.dryRun) {
      return {
        dryRun: true,
        requestedCount: uniqueProductIds.length,
        eligibleCount: eligible.length,
        rejectedCount: rejected.length,
        eligible,
        rejected
      };
    }

    if (eligible.length === 0) {
      throw new AppError("CONFLICT", "Нет товаров, подходящих для выбранного bulk-обновления статуса");
    }

    const eligibleIds = eligible.map((item) => item.productId);
    await productRepository.updateProductsStatusByIds(eligibleIds, params.status);

    await Promise.all(
      eligible.map((item) =>
        auditRepository.logAdminAction({
          adminId,
          action: "PRODUCT_UPDATE",
          targetType: "PRODUCT",
          targetId: item.productId,
          details: {
            fromStatus: item.fromStatus,
            toStatus: item.toStatus,
            source: "bulk"
          }
        })
      )
    );

    await auditRepository.logAdminAction({
      adminId,
      action: "PRODUCT_STATUS_BULK_UPDATE",
      targetType: "PRODUCT",
      targetId: "bulk",
      details: {
        requestedCount: uniqueProductIds.length,
        updatedCount: eligible.length,
        rejectedCount: rejected.length,
        status: params.status
      }
    });

    return {
      dryRun: false,
      requestedCount: uniqueProductIds.length,
      updatedCount: eligible.length,
      rejectedCount: rejected.length,
      updatedProductIds: eligibleIds,
      rejected
    };
  },

  listProductFilterPresets: async (adminId: string) => {
    const presets = await adminProductFilterPresetRepository.listByAdminId(adminId);
    return presets.map((preset) => mapProductFilterPreset(preset));
  },

  createProductFilterPreset: async (
    adminId: string,
    payload: {
      name: string;
      filters: {
        search?: string;
        brand?: string;
        categoryId?: string;
        status?: ProductStatus;
        sortBy?: "newest" | "price_asc" | "price_desc" | "name_asc";
      };
      isDefault: boolean;
    }
  ) => {
    try {
      const created = await adminProductFilterPresetRepository.create({
        adminId,
        name: payload.name.trim(),
        filters: normalizeProductFilterPresetFilters(payload.filters),
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "PRODUCT_FILTER_PRESET_CREATE",
        targetType: "PRODUCT_FILTER_PRESET",
        targetId: created.id,
        details: {
          name: created.name,
          isDefault: created.isDefault
        }
      });

      return mapProductFilterPreset(created);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  updateProductFilterPreset: async (
    adminId: string,
    presetId: string,
    payload: {
      name?: string;
      filters?: {
        search?: string;
        brand?: string;
        categoryId?: string;
        status?: ProductStatus;
        sortBy?: "newest" | "price_asc" | "price_desc" | "name_asc";
      };
      isDefault?: boolean;
    }
  ) => {
    const existing = await adminProductFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    try {
      const updated = await adminProductFilterPresetRepository.update({
        adminId,
        presetId,
        name: payload.name?.trim(),
        filters: payload.filters ? normalizeProductFilterPresetFilters(payload.filters) : undefined,
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "PRODUCT_FILTER_PRESET_UPDATE",
        targetType: "PRODUCT_FILTER_PRESET",
        targetId: updated.id,
        details: {
          beforeName: existing.name,
          afterName: updated.name,
          beforeIsDefault: existing.isDefault,
          afterIsDefault: updated.isDefault
        }
      });

      return mapProductFilterPreset(updated);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  deleteProductFilterPreset: async (adminId: string, presetId: string) => {
    const existing = await adminProductFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    await adminProductFilterPresetRepository.removeById(adminId, presetId);
    await auditRepository.logAdminAction({
      adminId,
      action: "PRODUCT_FILTER_PRESET_DELETE",
      targetType: "PRODUCT_FILTER_PRESET",
      targetId: presetId,
      details: {
        name: existing.name,
        isDefault: existing.isDefault
      }
    });

    return {
      deleted: true
    };
  },

  listOrders: async (params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: OrderStatus;
    dateFrom?: string;
    dateTo?: string;
    minTotalCents?: number;
    maxTotalCents?: number;
  }) => {
    const { dateFrom, dateToExclusive } = parseDateRange({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      orderRepository.listOrdersPaginated({
        skip,
        take: params.pageSize,
        search: params.search,
        status: params.status,
        dateFrom,
        dateToExclusive,
        minTotalCents: params.minTotalCents,
        maxTotalCents: params.maxTotalCents
      }),
      orderRepository.countOrders({
        search: params.search,
        status: params.status,
        dateFrom,
        dateToExclusive,
        minTotalCents: params.minTotalCents,
        maxTotalCents: params.maxTotalCents
      })
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  listOrdersCursor: async (params: {
    limit: number;
    cursor?: string;
    search?: string;
    status?: OrderStatus;
    dateFrom?: string;
    dateTo?: string;
    minTotalCents?: number;
    maxTotalCents?: number;
  }) => {
    const { dateFrom, dateToExclusive } = parseDateRange({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });

    const result = await orderRepository.listOrdersCursor({
      take: params.limit,
      cursor: params.cursor,
      search: params.search,
      status: params.status,
      dateFrom,
      dateToExclusive,
      minTotalCents: params.minTotalCents,
      maxTotalCents: params.maxTotalCents
    });

    return {
      items: result.items,
      nextCursor: result.nextCursor
    };
  },

  getOrderDetails: async (orderId: string) => {
    const order = await orderRepository.findOrderByIdForAdminDetailed(orderId);
    if (!order) {
      throw new AppError("NOT_FOUND", "Заказ не найден");
    }

    const statusTimeline = await auditRepository.listAdminActionsByTarget({
      targetType: "ORDER",
      targetId: order.id,
      action: "ORDER_STATUS_CHANGE",
      take: 100
    });

    return {
      ...order,
      statusTimeline: statusTimeline.map((entry) => ({
        id: entry.id,
        adminId: entry.adminId,
        adminEmail: entry.admin.email,
        fromStatus: extractStringFromDetails(entry.details, "fromStatus"),
        toStatus: extractStringFromDetails(entry.details, "toStatus"),
        createdAt: entry.createdAt
      }))
    };
  },

  updateOrderStatus: async (
    adminId: string,
    orderId: string,
    status: OrderStatus
  ) => {
    const order = await orderRepository.findOrderByIdForAdmin(orderId);
    if (!order) {
      throw new AppError("NOT_FOUND", "Заказ не найден");
    }

    const rejectionReason = getStatusTransitionRejectionReason(order, status);
    if (rejectionReason) {
      throw new AppError("CONFLICT", rejectionReason);
    }

    const previousStatus = order.status;
    const updated = await orderRepository.updateOrderStatus(order.id, status);
    await auditRepository.logAdminAction({
      adminId,
      action: "ORDER_STATUS_CHANGE",
      targetType: "ORDER",
      targetId: order.id,
      details: {
        fromStatus: previousStatus,
        toStatus: status
      }
    });

    return updated;
  },

  updateOrdersStatusBulk: async (
    adminId: string,
    params: {
      orderIds: string[];
      status: OrderStatus;
      dryRun: boolean;
    }
  ) => {
    const uniqueOrderIds = Array.from(new Set(params.orderIds));
    const orders = await orderRepository.findOrdersByIdsForAdmin(uniqueOrderIds);

    const foundOrderIds = new Set(orders.map((order) => order.id));
    const missingOrderIds = uniqueOrderIds.filter((orderId) => !foundOrderIds.has(orderId));
    if (missingOrderIds.length > 0) {
      throw new AppError("NOT_FOUND", `Не найдены заказы: ${missingOrderIds.join(", ")}`);
    }

    const evalued = orders.map((order) => {
      const rejectionReason = getStatusTransitionRejectionReason(order, params.status);
      return {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: params.status,
        canUpdate: rejectionReason === null,
        reason: rejectionReason
      };
    });

    const eligible = evalued.filter((item) => item.canUpdate);
    const rejected = evalued.filter((item) => !item.canUpdate);

    if (params.dryRun) {
      return {
        dryRun: true,
        requestedCount: uniqueOrderIds.length,
        eligibleCount: eligible.length,
        rejectedCount: rejected.length,
        eligible,
        rejected
      };
    }

    if (eligible.length === 0) {
      throw new AppError("CONFLICT", "Нет заказов, подходящих под выбранный переход статуса");
    }

    const updated = await Promise.all(
      eligible.map((item) => orderRepository.updateOrderStatus(item.orderId, params.status))
    );

    await Promise.all(
      eligible.map((item) =>
        auditRepository.logAdminAction({
          adminId,
          action: "ORDER_STATUS_CHANGE",
          targetType: "ORDER",
          targetId: item.orderId,
          details: {
            fromStatus: item.fromStatus,
            toStatus: item.toStatus,
            source: "bulk"
          }
        })
      )
    );

    await auditRepository.logAdminAction({
      adminId,
      action: "ORDER_STATUS_CHANGE_BULK",
      targetType: "ORDER",
      targetId: "bulk",
      details: {
        requestedCount: uniqueOrderIds.length,
        updatedCount: updated.length,
        rejectedCount: rejected.length,
        targetStatus: params.status
      }
    });

    return {
      dryRun: false,
      requestedCount: uniqueOrderIds.length,
      updatedCount: updated.length,
      rejectedCount: rejected.length,
      updatedOrderIds: updated.map((item) => item.id),
      rejected
    };
  },

  exportOrdersCsv: async (
    adminId: string,
    params: {
      search?: string;
      status?: OrderStatus;
      dateFrom?: string;
      dateTo?: string;
      minTotalCents?: number;
      maxTotalCents?: number;
      limit: number;
    }
  ) => {
    const { dateFrom, dateToExclusive } = parseDateRange({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });

    const headers = [
      "orderId",
      "userEmail",
      "status",
      "itemsCount",
      "totalCents",
      "currency",
      "createdAt",
      "updatedAt"
    ];

    const rows: string[][] = [];
    const pageSize = Math.min(200, params.limit);
    let cursor: string | undefined;
    let exportedCount = 0;

    while (exportedCount < params.limit) {
      const chunk = await orderRepository.listOrdersCursor({
        take: Math.min(pageSize, params.limit - exportedCount),
        cursor,
        search: params.search,
        status: params.status,
        dateFrom,
        dateToExclusive,
        minTotalCents: params.minTotalCents,
        maxTotalCents: params.maxTotalCents
      });

      if (chunk.items.length === 0) {
        break;
      }

      rows.push(
        ...chunk.items.map((item) => [
          item.id,
          item.user.email,
          item.status,
          String(item._count.items),
          String(item.totalCents),
          item.currency,
          item.createdAt.toISOString(),
          item.updatedAt.toISOString()
        ])
      );

      exportedCount += chunk.items.length;
      if (!chunk.nextCursor) {
        break;
      }
      cursor = chunk.nextCursor;
    }

    const csv = buildCsv(headers, rows);

    await auditRepository.logAdminAction({
      adminId,
      action: "ORDER_EXPORT",
      targetType: "ORDER",
      targetId: "bulk",
      details: {
        limit: params.limit,
        status: params.status ?? null,
        search: params.search ?? null,
        dateFrom: params.dateFrom ?? null,
        dateTo: params.dateTo ?? null,
        minTotalCents: params.minTotalCents ?? null,
        maxTotalCents: params.maxTotalCents ?? null,
        exportedCount
      }
    });

    return {
      csv,
      exportedCount
    };
  },

  listAdminLogs: async (params: {
    page: number;
    pageSize: number;
    action?: string;
    targetType?: string;
    search?: string;
  }) => {
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      auditRepository.listAdminActions({
        skip,
        take: params.pageSize,
        action: params.action,
        targetType: params.targetType,
        search: params.search
      }),
      auditRepository.countAdminActions({
        action: params.action,
        targetType: params.targetType,
        search: params.search
      })
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  listSessions: async (params: {
    page: number;
    pageSize: number;
    search?: string;
    userId?: string;
    status?: "ACTIVE" | "REVOKED" | "EXPIRED";
  }) => {
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      sessionRepository.listAdminSessions({
        skip,
        take: params.pageSize,
        search: params.search,
        userId: params.userId,
        status: params.status
      }),
      sessionRepository.countAdminSessions({
        search: params.search,
        userId: params.userId,
        status: params.status
      })
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  revokeSession: async (adminId: string, sessionId: string) => {
    const session = await sessionRepository.findById(sessionId);
    if (!session) {
      throw new AppError("NOT_FOUND", "Сессия не найдена");
    }

    await Promise.all([
      sessionRepository.revokeByUserAndId(session.userId, session.id),
      refreshTokenRepository.revokeBySessionId(session.id),
      auditRepository.logAdminAction({
        adminId,
        action: "SESSION_REVOKE",
        targetType: "SESSION",
        targetId: session.id,
        details: {
          userId: session.userId
        }
      })
    ]);

    return { revoked: true };
  },

  revokeSessionsBulk: async (
    adminId: string,
    params: {
      userId?: string;
      search?: string;
      status?: "ACTIVE" | "REVOKED" | "EXPIRED";
      limit: number;
      dryRun: boolean;
      excludeSessionId?: string;
    }
  ) => {
    const candidates = await sessionRepository.listAdminSessionCandidates({
      take: params.limit,
      userId: params.userId,
      search: params.search,
      status: params.status,
      excludeSessionId: params.excludeSessionId
    });

    if (candidates.length === 0) {
      return {
        dryRun: params.dryRun,
        matchedCount: 0,
        revokedCount: 0
      };
    }

    if (params.dryRun) {
      return {
        dryRun: true,
        matchedCount: candidates.length,
        revokedCount: 0,
        candidateSessionIds: candidates.map((session) => session.id)
      };
    }

    const candidateSessionIds = candidates.map((session) => session.id);
    const [revokeSessionsResult] = await Promise.all([
      sessionRepository.revokeByIds(candidateSessionIds),
      refreshTokenRepository.revokeBySessionIds(candidateSessionIds)
    ]);

    await auditRepository.logAdminAction({
      adminId,
      action: "SESSION_REVOKE_BULK",
      targetType: "SESSION",
      targetId: "bulk",
      details: {
        userId: params.userId ?? null,
        search: params.search ?? null,
        status: params.status ?? null,
        limit: params.limit,
        matchedCount: candidates.length,
        revokedCount: revokeSessionsResult.count,
        excludeSessionId: params.excludeSessionId ?? null
      }
    });

    return {
      dryRun: false,
      matchedCount: candidates.length,
      revokedCount: revokeSessionsResult.count
    };
  },

  listWebhookEvents: async (params: {
    page: number;
    pageSize: number;
    eventType?: string;
    processed?: boolean;
  }) => {
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      stripeEventRepository.listPaginated({
        skip,
        take: params.pageSize,
        eventType: params.eventType,
        processed: params.processed
      }),
      stripeEventRepository.countPaginated({
        eventType: params.eventType,
        processed: params.processed
      })
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  replayWebhookEvent: async (adminId: string, eventId: string) => {
    const result = await checkoutService.replayStoredEvent(eventId);
    await auditRepository.logAdminAction({
      adminId,
      action: "WEBHOOK_REPLAY",
      targetType: "STRIPE_EVENT",
      targetId: eventId
    });
    return result;
  },

  replayWebhookEventsBulk: async (
    adminId: string,
    params: {
      eventType?: string;
      processed?: boolean;
      limit: number;
      dryRun: boolean;
    }
  ) => {
    const events = await stripeEventRepository.listPaginated({
      skip: 0,
      take: params.limit,
      eventType: params.eventType,
      processed: params.processed
    });

    if (events.length === 0) {
      return {
        dryRun: params.dryRun,
        matchedCount: 0,
        replayedCount: 0
      };
    }

    if (params.dryRun) {
      return {
        dryRun: true,
        matchedCount: events.length,
        replayedCount: 0,
        candidateEventIds: events.map((event) => event.eventId)
      };
    }

    for (const event of events) {
      await checkoutService.replayStoredEvent(event.eventId);
    }

    await auditRepository.logAdminAction({
      adminId,
      action: "WEBHOOK_REPLAY_BULK",
      targetType: "STRIPE_EVENT",
      targetId: "bulk",
      details: {
        replayedCount: events.length,
        eventType: params.eventType,
        processed: params.processed,
        limit: params.limit
      }
    });

    return {
      dryRun: false,
      matchedCount: events.length,
      replayedCount: events.length
    };
  },

  listOrderFilterPresets: async (adminId: string) => {
    const presets = await adminOrderFilterPresetRepository.listByAdminId(adminId);
    return presets.map((preset) => mapOrderFilterPreset(preset));
  },

  createOrderFilterPreset: async (
    adminId: string,
    payload: {
      name: string;
      filters: {
        search?: string;
        status?: OrderStatus;
        dateFrom?: string;
        dateTo?: string;
        minTotalCents?: number;
        maxTotalCents?: number;
      };
      isDefault: boolean;
    }
  ) => {
    try {
      const created = await adminOrderFilterPresetRepository.create({
        adminId,
        name: payload.name.trim(),
        filters: normalizeOrderFilterPresetFilters(payload.filters),
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "ORDER_FILTER_PRESET_CREATE",
        targetType: "ORDER_FILTER_PRESET",
        targetId: created.id,
        details: {
          name: created.name,
          isDefault: created.isDefault
        }
      });

      return mapOrderFilterPreset(created);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }

      throw error;
    }
  },

  updateOrderFilterPreset: async (
    adminId: string,
    presetId: string,
    payload: {
      name?: string;
      filters?: {
        search?: string;
        status?: OrderStatus;
        dateFrom?: string;
        dateTo?: string;
        minTotalCents?: number;
        maxTotalCents?: number;
      };
      isDefault?: boolean;
    }
  ) => {
    const existing = await adminOrderFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    try {
      const updated = await adminOrderFilterPresetRepository.update({
        adminId,
        presetId,
        name: payload.name?.trim(),
        filters: payload.filters ? normalizeOrderFilterPresetFilters(payload.filters) : undefined,
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "ORDER_FILTER_PRESET_UPDATE",
        targetType: "ORDER_FILTER_PRESET",
        targetId: updated.id,
        details: {
          beforeName: existing.name,
          afterName: updated.name,
          beforeIsDefault: existing.isDefault,
          afterIsDefault: updated.isDefault
        }
      });

      return mapOrderFilterPreset(updated);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }

      throw error;
    }
  },

  deleteOrderFilterPreset: async (adminId: string, presetId: string) => {
    const existing = await adminOrderFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    await adminOrderFilterPresetRepository.removeById(adminId, presetId);
    await auditRepository.logAdminAction({
      adminId,
      action: "ORDER_FILTER_PRESET_DELETE",
      targetType: "ORDER_FILTER_PRESET",
      targetId: presetId,
      details: {
        name: existing.name,
        isDefault: existing.isDefault
      }
    });

    return {
      deleted: true
    };
  }
};
