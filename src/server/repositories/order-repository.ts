import { prisma } from "@/lib/prisma";
import { OrderStatus, Prisma } from "@prisma/client";

type DailyOrdersAggregateRow = {
  day: Date;
  ordersCount: bigint;
  paidOrdersCount: bigint;
  revenueCents: bigint;
};

type AdminOrderListFilters = {
  search?: string;
  status?: OrderStatus;
  dateFrom?: Date;
  dateToExclusive?: Date;
  minTotalCents?: number;
  maxTotalCents?: number;
};

const buildAdminOrderWhere = (filters: AdminOrderListFilters): Prisma.OrderWhereInput => ({
  deletedAt: null,
  status: filters.status,
  createdAt:
    filters.dateFrom || filters.dateToExclusive
      ? {
          gte: filters.dateFrom,
          lt: filters.dateToExclusive
        }
      : undefined,
  totalCents:
    filters.minTotalCents !== undefined || filters.maxTotalCents !== undefined
      ? {
          gte: filters.minTotalCents,
          lte: filters.maxTotalCents
        }
      : undefined,
  OR: filters.search
    ? [
        {
          id: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          user: {
            email: {
              contains: filters.search,
              mode: "insensitive"
            }
          }
        }
      ]
    : undefined
});

export const orderRepository = {
  listUserOrders: (userId: string) =>
    prisma.order.findMany({
      where: { userId, deletedAt: null },
      include: { items: true, payments: true },
      orderBy: { createdAt: "desc" }
    }),

  listUserOrdersPaginated: (params: {
    userId: string;
    skip: number;
    take: number;
    status?: OrderStatus;
  }) =>
    prisma.order.findMany({
      where: {
        userId: params.userId,
        deletedAt: null,
        status: params.status
      },
      include: { items: true, payments: true },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" }
    }),

  countUserOrders: (params: { userId: string; status?: OrderStatus }) =>
    prisma.order.count({
      where: {
        userId: params.userId,
        deletedAt: null,
        status: params.status
      }
    }),

  createOrder: (data: Parameters<typeof prisma.order.create>[0]["data"]) => prisma.order.create({ data }),

  markPaid: (orderId: string) =>
    prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID" }
    }),

  findByCheckoutId: (checkoutId: string) =>
    prisma.order.findUnique({
      where: { stripeCheckoutId: checkoutId },
      include: { items: true, payments: true }
    }),

  findUserOrderById: (params: { userId: string; orderId: string }) =>
    prisma.order.findFirst({
      where: {
        id: params.orderId,
        userId: params.userId,
        deletedAt: null
      },
      include: { items: true, payments: true }
    }),

  listOrdersPaginated: (params: {
    skip: number;
    take: number;
    search?: string;
    status?: OrderStatus;
    dateFrom?: Date;
    dateToExclusive?: Date;
    minTotalCents?: number;
    maxTotalCents?: number;
  }) =>
    prisma.order.findMany({
      where: buildAdminOrderWhere(params),
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),

  listOrdersCursor: async (params: {
    take: number;
    cursor?: string;
    search?: string;
    status?: OrderStatus;
    dateFrom?: Date;
    dateToExclusive?: Date;
    minTotalCents?: number;
    maxTotalCents?: number;
  }) => {
    const rows = await prisma.order.findMany({
      where: buildAdminOrderWhere(params),
      take: params.take + 1,
      skip: params.cursor ? 1 : 0,
      cursor: params.cursor
        ? {
            id: params.cursor
          }
        : undefined,
      select: {
        id: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    const hasMore = rows.length > params.take;
    const items = hasMore ? rows.slice(0, params.take) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items,
      nextCursor
    };
  },

  countOrders: (params?: {
    search?: string;
    status?: OrderStatus;
    dateFrom?: Date;
    dateToExclusive?: Date;
    minTotalCents?: number;
    maxTotalCents?: number;
  }) =>
    prisma.order.count({
      where: buildAdminOrderWhere(params ?? {})
    }),

  findOrderByIdForAdmin: (orderId: string) =>
    prisma.order.findFirst({
      where: {
        id: orderId,
        deletedAt: null
      },
      select: {
        id: true,
        userId: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true
          }
        },
        payments: {
          select: {
            id: true,
            status: true,
            amountCents: true
          }
        }
      }
    }),

  findOrderByIdForAdminDetailed: (orderId: string) =>
    prisma.order.findFirst({
      where: {
        id: orderId,
        deletedAt: null
      },
      select: {
        id: true,
        status: true,
        subtotalCents: true,
        shippingCents: true,
        taxCents: true,
        discountCents: true,
        totalCents: true,
        currency: true,
        shippingAddressJson: true,
        billingAddressJson: true,
        stripeCheckoutId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true
          }
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPriceCents: true,
            totalPriceCents: true,
            currency: true,
            customizationId: true,
            product: {
              select: {
                id: true,
                name: true,
                brand: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                color: true,
                size: true,
                sku: true
              }
            }
          }
        },
        payments: {
          select: {
            id: true,
            provider: true,
            status: true,
            amountCents: true,
            currency: true,
            stripePaymentIntentId: true,
            stripeChargeId: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            createdAt: "asc"
          }
        },
        _count: {
          select: {
            items: true,
            payments: true
          }
        }
      }
    }),

  updateOrderStatus: (orderId: string, status: OrderStatus) =>
    prisma.order.update({
      where: { id: orderId },
      data: {
        status
      },
      select: {
        id: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    }),

  listOrdersForExport: (params: {
    take: number;
    search?: string;
    status?: OrderStatus;
    dateFrom?: Date;
    dateToExclusive?: Date;
    minTotalCents?: number;
    maxTotalCents?: number;
  }) =>
    prisma.order.findMany({
      where: buildAdminOrderWhere(params),
      take: params.take,
      select: {
        id: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),

  findOrdersByIdsForAdmin: (orderIds: string[]) =>
    prisma.order.findMany({
      where: {
        id: {
          in: orderIds
        },
        deletedAt: null
      },
      select: {
        id: true,
        status: true,
        payments: {
          select: {
            id: true,
            status: true
          }
        }
      }
    }),

  countOrdersInRange: (params: { start: Date; end: Date }) =>
    prisma.order.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: params.start,
          lt: params.end
        }
      }
    }),

  countPaidOrdersInRange: (params: { start: Date; end: Date }) =>
    prisma.order.count({
      where: {
        deletedAt: null,
        status: OrderStatus.PAID,
        createdAt: {
          gte: params.start,
          lt: params.end
        }
      }
    }),

  sumPaidRevenueInRange: async (params: { start: Date; end: Date }) => {
    const aggregate = await prisma.order.aggregate({
      _sum: {
        totalCents: true
      },
      where: {
        deletedAt: null,
        status: OrderStatus.PAID,
        createdAt: {
          gte: params.start,
          lt: params.end
        }
      }
    });

    return aggregate._sum.totalCents ?? 0;
  },

  dailyOrdersAggregate: async (params: { start: Date; end: Date }) => {
    const rows = await prisma.$queryRaw<DailyOrdersAggregateRow[]>(Prisma.sql`
      SELECT
        series.day AS day,
        COALESCE(COUNT(ord.id), 0)::bigint AS "ordersCount",
        COALESCE(COUNT(ord.id) FILTER (WHERE ord.status = 'PAID'), 0)::bigint AS "paidOrdersCount",
        COALESCE(SUM(ord."totalCents") FILTER (WHERE ord.status = 'PAID'), 0)::bigint AS "revenueCents"
      FROM generate_series(
        ${params.start}::date,
        (${params.end}::date - INTERVAL '1 day'),
        INTERVAL '1 day'
      ) AS series(day)
      LEFT JOIN "Order" ord
        ON ord."deletedAt" IS NULL
        AND ord."createdAt" >= series.day
        AND ord."createdAt" < series.day + INTERVAL '1 day'
      GROUP BY series.day
      ORDER BY series.day ASC
    `);

    return rows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      ordersCount: Number(row.ordersCount),
      paidOrdersCount: Number(row.paidOrdersCount),
      revenueCents: Number(row.revenueCents)
    }));
  }
};
