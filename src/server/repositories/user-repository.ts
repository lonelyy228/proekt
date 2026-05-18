import { Prisma, Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const userRepository = {
  findByEmail: (email: string): Promise<User | null> =>
    prisma.user.findFirst({
      where: { email, deletedAt: null }
    }),

  findById: (id: string): Promise<User | null> =>
    prisma.user.findFirst({ where: { id, deletedAt: null } }),

  create: (data: Prisma.UserCreateInput): Promise<User> => prisma.user.create({ data }),

  setTwoFactor: (userId: string, params: { enabled: boolean; secret: string | null }): Promise<User> =>
    prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: params.enabled,
        twoFactorSecretEnc: params.secret
      }
    }),

  listUsers: (params: { skip: number; take: number; search?: string; role?: Role; isBlocked?: boolean }) =>
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: params.role,
        isBlocked: params.isBlocked,
        email: params.search
          ? {
              contains: params.search,
              mode: "insensitive"
            }
          : undefined
      },
      select: {
        id: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true
      },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" }
    }),

  countUsers: (params: { search?: string; role?: Role; isBlocked?: boolean }): Promise<number> =>
    prisma.user.count({
      where: {
        deletedAt: null,
        role: params.role,
        isBlocked: params.isBlocked,
        email: params.search
          ? {
              contains: params.search,
              mode: "insensitive"
            }
          : undefined
      }
    }),

  countUsersInRange: (params: { start: Date; end: Date }): Promise<number> =>
    prisma.user.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: params.start,
          lt: params.end
        }
      }
    }),

  updateUserAdminFields: (userId: string, data: Prisma.UserUpdateInput) =>
    prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true
      }
    }),

  findUsersByIdsForAdmin: (userIds: string[]) =>
    prisma.user.findMany({
      where: {
        id: {
          in: userIds
        },
        deletedAt: null
      },
      select: {
        id: true,
        role: true,
        isBlocked: true
      }
    }),

  updateUsersAdminFieldsByIds: (userIds: string[], data: Prisma.UserUpdateInput) =>
    prisma.user.updateMany({
      where: {
        id: {
          in: userIds
        },
        deletedAt: null
      },
      data
    }),

  countActiveAdmins: () =>
    prisma.user.count({
      where: {
        deletedAt: null,
        role: Role.ADMIN,
        isBlocked: false
      }
    })
};
