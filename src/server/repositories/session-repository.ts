import { prisma } from "@/lib/prisma";

const buildAdminSessionWhere = (params: {
  status?: "ACTIVE" | "REVOKED" | "EXPIRED";
  userId?: string;
  search?: string;
  excludeSessionId?: string;
}) => ({
  status: params.status,
  userId: params.userId,
  id: params.excludeSessionId
    ? {
        not: params.excludeSessionId
      }
    : undefined,
  user: params.search
    ? {
        email: {
          contains: params.search,
          mode: "insensitive" as const
        }
      }
    : undefined
});

export const sessionRepository = {
  createSession: (data: {
    userId: string;
    userAgent: string | null;
    ipAddress: string | null;
    deviceType: string;
    expiresAt: Date;
  }) =>
    prisma.session.create({
      data: {
        userId: data.userId,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        deviceType: data.deviceType,
        expiresAt: data.expiresAt
      }
    }),

  revokeSession: (sessionId: string) =>
    prisma.session.update({
      where: { id: sessionId },
      data: { status: "REVOKED" }
    }),

  touchSession: (sessionId: string) =>
    prisma.session.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() }
    }),

  listByUserId: (userId: string) =>
    prisma.session.findMany({
      where: { userId },
      orderBy: { lastSeenAt: "desc" }
    }),

  findById: (sessionId: string) =>
    prisma.session.findUnique({
      where: { id: sessionId }
    }),

  revokeByUserAndId: (userId: string, sessionId: string) =>
    prisma.session.updateMany({
      where: {
        id: sessionId,
        userId,
        status: "ACTIVE"
      },
      data: {
        status: "REVOKED"
      }
    }),

  listAdminSessions: (params: {
    skip: number;
    take: number;
    status?: "ACTIVE" | "REVOKED" | "EXPIRED";
    userId?: string;
    search?: string;
  }) =>
    prisma.session.findMany({
      where: buildAdminSessionWhere(params),
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      skip: params.skip,
      take: params.take,
      orderBy: { lastSeenAt: "desc" }
    }),

  countAdminSessions: (params: {
    status?: "ACTIVE" | "REVOKED" | "EXPIRED";
    userId?: string;
    search?: string;
  }) =>
    prisma.session.count({
      where: buildAdminSessionWhere(params)
    }),

  listAdminSessionCandidates: (params: {
    take: number;
    status?: "ACTIVE" | "REVOKED" | "EXPIRED";
    userId?: string;
    search?: string;
    excludeSessionId?: string;
  }) =>
    prisma.session.findMany({
      where: buildAdminSessionWhere(params),
      select: {
        id: true,
        userId: true,
        status: true
      },
      take: params.take,
      orderBy: { lastSeenAt: "desc" }
    }),

  revokeByIds: (sessionIds: string[]) =>
    prisma.session.updateMany({
      where: {
        id: {
          in: sessionIds
        }
      },
      data: {
        status: "REVOKED"
      }
    }),

  revokeActiveByUserIdExcept: (userId: string, excludeSessionId?: string) =>
    prisma.session.updateMany({
      where: {
        userId,
        status: "ACTIVE",
        id: excludeSessionId
          ? {
              not: excludeSessionId
            }
          : undefined
      },
      data: {
        status: "REVOKED"
      }
    })
};
