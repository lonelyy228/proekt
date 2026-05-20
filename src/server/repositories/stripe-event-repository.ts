import { prisma } from "@/lib/prisma";

export const stripeEventRepository = {
  findByEventId: (eventId: string) => prisma.stripeEventLog.findUnique({ where: { eventId } }),

  upsertEvent: (eventId: string, eventType: string, payload: object) =>
    prisma.stripeEventLog.upsert({
      where: { eventId },
      create: {
        eventId,
        eventType,
        payload
      },
      update: {
        eventType,
        payload
      }
    }),

  create: (eventId: string, eventType: string, payload: object) =>
    prisma.stripeEventLog.create({
      data: {
        eventId,
        eventType,
        payload
      }
    }),

  markProcessed: (eventId: string) =>
    prisma.stripeEventLog.update({
      where: { eventId },
      data: { processedAt: new Date() }
    }),

  listPaginated: (params: {
    skip: number;
    take: number;
    eventType?: string;
    processed?: boolean;
  }) =>
    prisma.stripeEventLog.findMany({
      where: {
        eventType: params.eventType,
        processedAt:
          params.processed === undefined ? undefined : params.processed ? { not: null } : null
      },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" }
    }),

  countPaginated: (params: { eventType?: string; processed?: boolean }) =>
    prisma.stripeEventLog.count({
      where: {
        eventType: params.eventType,
        processedAt:
          params.processed === undefined ? undefined : params.processed ? { not: null } : null
      }
    }),

  resetProcessedAt: (eventId: string) =>
    prisma.stripeEventLog.update({
      where: { eventId },
      data: { processedAt: null }
    }),

  countCreatedSince: (createdAtFrom: Date) =>
    prisma.stripeEventLog.count({
      where: {
        createdAt: {
          gte: createdAtFrom
        }
      }
    }),

  countProcessedSince: (processedAtFrom: Date) =>
    prisma.stripeEventLog.count({
      where: {
        processedAt: {
          gte: processedAtFrom
        }
      }
    }),

  countUnprocessedOlderThan: (createdAtBefore: Date) =>
    prisma.stripeEventLog.count({
      where: {
        processedAt: null,
        createdAt: {
          lte: createdAtBefore
        }
      }
    }),

  findOldestUnprocessed: () =>
    prisma.stripeEventLog.findFirst({
      where: {
        processedAt: null
      },
      orderBy: {
        createdAt: "asc"
      },
      select: {
        createdAt: true
      }
    }),

  listForExport: (params: {
    take: number;
    eventType?: string;
    processed?: boolean;
  }) =>
    prisma.stripeEventLog.findMany({
      where: {
        eventType: params.eventType,
        processedAt:
          params.processed === undefined ? undefined : params.processed ? { not: null } : null
      },
      take: params.take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        eventId: true,
        eventType: true,
        createdAt: true,
        processedAt: true
      }
    }),

  listPopularEventTypes: (params: {
    take: number;
    processed?: boolean;
    eventTypeContains?: string;
    createdAtFrom?: Date;
  }) =>
    prisma.stripeEventLog.groupBy({
      by: ["eventType"],
      where: {
        createdAt: params.createdAtFrom ? { gte: params.createdAtFrom } : undefined,
        processedAt:
          params.processed === undefined ? undefined : params.processed ? { not: null } : null,
        eventType: params.eventTypeContains
          ? { contains: params.eventTypeContains, mode: "insensitive" }
          : undefined
      },
      _count: {
        eventType: true
      },
      orderBy: {
        _count: {
          eventType: "desc"
        }
      },
      take: params.take
    })
};
