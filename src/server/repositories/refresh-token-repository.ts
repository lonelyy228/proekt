import { prisma } from "@/lib/prisma";

export const refreshTokenRepository = {
  createToken: (data: {
    userId: string;
    sessionId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }) =>
    prisma.refreshToken.create({
      data
    }),

  findByHash: (tokenHash: string) => prisma.refreshToken.findUnique({ where: { tokenHash } }),

  revokeToken: (tokenHash: string, replacedBy?: string) =>
    prisma.refreshToken.update({
      where: { tokenHash },
      data: {
        isRevoked: true,
        replacedBy
      }
    }),

  revokeFamily: (familyId: string) =>
    prisma.refreshToken.updateMany({
      where: { familyId, isRevoked: false },
      data: { isRevoked: true }
    }),

  revokeBySessionId: (sessionId: string) =>
    prisma.refreshToken.updateMany({
      where: { sessionId, isRevoked: false },
      data: { isRevoked: true }
    }),

  revokeByUserIdExceptSession: (userId: string, excludeSessionId?: string) =>
    prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
        sessionId: excludeSessionId
          ? {
              not: excludeSessionId
            }
          : undefined
      },
      data: {
        isRevoked: true
      }
    }),

  revokeBySessionIds: (sessionIds: string[]) =>
    prisma.refreshToken.updateMany({
      where: {
        sessionId: {
          in: sessionIds
        },
        isRevoked: false
      },
      data: {
        isRevoked: true
      }
    })
};
