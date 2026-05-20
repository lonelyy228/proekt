import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type AdminActionWhereParams = {
  action?: string;
  targetType?: string;
  search?: string;
  createdAtFrom?: Date;
};

const buildAdminActionWhere = (params: AdminActionWhereParams): Prisma.AdminActionWhereInput => ({
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
  createdAt: params.createdAtFrom
    ? {
        gte: params.createdAtFrom
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
});

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
      where: buildAdminActionWhere(params),
      skip: params.skip,
      take: params.take,
      include: { admin: true },
      orderBy: { createdAt: "desc" }
    }),

  listAdminActionsForExport: (params: {
    take: number;
    action?: string;
    targetType?: string;
    search?: string;
  }) =>
    prisma.adminAction.findMany({
      where: buildAdminActionWhere(params),
      take: params.take,
      include: {
        admin: {
          select: {
            id: true,
            email: true
          }
        }
      },
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
      where: buildAdminActionWhere({
        action: params?.action,
        targetType: params?.targetType,
        search: params?.search
      })
    }),

  listPopularAdminActions: (params: {
    take: number;
    targetType?: string;
    search?: string;
    createdAtFrom?: Date;
  }) =>
    prisma.adminAction.groupBy({
      by: ["action"],
      where: buildAdminActionWhere({
        targetType: params.targetType,
        search: params.search,
        createdAtFrom: params.createdAtFrom
      }),
      _count: {
        action: true
      },
      orderBy: [
        {
          _count: {
            action: "desc"
          }
        },
        {
          action: "asc"
        }
      ],
      take: params.take
    }),

  listPopularAdminTargetTypes: (params: {
    take: number;
    action?: string;
    search?: string;
    createdAtFrom?: Date;
  }) =>
    prisma.adminAction.groupBy({
      by: ["targetType"],
      where: buildAdminActionWhere({
        action: params.action,
        search: params.search,
        createdAtFrom: params.createdAtFrom
      }),
      _count: {
        targetType: true
      },
      orderBy: [
        {
          _count: {
            targetType: "desc"
          }
        },
        {
          targetType: "asc"
        }
      ],
      take: params.take
    })
};
