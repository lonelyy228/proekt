import { prisma } from "@/lib/prisma";

export const stripeEventRepository = {
  findByEventId: (eventId: string) => prisma.stripeEventLog.findUnique({ where: { eventId } }),

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
    })
};
