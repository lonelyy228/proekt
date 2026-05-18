import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const auditRepository = {
  log: (params: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) =>
    prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      }
    }),

  logAdminAction: (params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
  }) =>
    prisma.adminAction.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details as Prisma.InputJsonValue | undefined
      }
    }),

  listAdminActions: (params: {
    skip: number;
    take: number;
    action?: string;
    targetType?: string;
    search?: string;
  }) =>
    prisma.adminAction.findMany({
      where: {
        action: params.action
          ? {
              equals: params.action
            }
          : undefined,
        targetType: params.targetType
          ? {
              equals: params.targetType
            }
          : undefined,
        OR: params.search
          ? [
              {
                targetId: {
                  contains: params.search,
                  mode: "insensitive"
                }
              },
              {
                admin: {
                  email: {
                    contains: params.search,
                    mode: "insensitive"
                  }
                }
              }
            ]
          : undefined
      },
      skip: params.skip,
      take: params.take,
      include: { admin: true },
      orderBy: { createdAt: "desc" }
    }),

  listAdminActionsByTarget: (params: {
    targetType: string;
    targetId: string;
    action?: string;
    take?: number;
  }) =>
    prisma.adminAction.findMany({
      where: {
        targetType: params.targetType,
        targetId: params.targetId,
        action: params.action
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true
          }
        }
      },
      take: params.take,
      orderBy: {
        createdAt: "desc"
      }
    }),

  countAdminActions: (params?: { action?: string; targetType?: string; search?: string }) =>
    prisma.adminAction.count({
      where: {
        action: params?.action
          ? {
              equals: params.action
            }
          : undefined,
        targetType: params?.targetType
          ? {
              equals: params.targetType
            }
          : undefined,
        OR: params?.search
          ? [
              {
                targetId: {
                  contains: params.search,
                  mode: "insensitive"
                }
              },
              {
                admin: {
                  email: {
                    contains: params.search,
                    mode: "insensitive"
                  }
                }
              }
            ]
          : undefined
      }
    })
};
