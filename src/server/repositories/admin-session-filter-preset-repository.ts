import { prisma } from "@/lib/prisma";
import { SessionStatus } from "@prisma/client";

type SessionPresetFiltersInput = {
  search?: string;
  status?: SessionStatus;
};

const toDbFields = (filters: SessionPresetFiltersInput) => ({
  search: filters.search ?? null,
  status: filters.status ?? null
});

export const adminSessionFilterPresetRepository = {
  listByAdminId: (adminId: string) =>
    prisma.adminSessionFilterPreset.findMany({
      where: {
        adminId
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),

  findByIdForAdmin: (adminId: string, presetId: string) =>
    prisma.adminSessionFilterPreset.findFirst({
      where: {
        id: presetId,
        adminId
      }
    }),

  create: (params: {
    adminId: string;
    name: string;
    filters: SessionPresetFiltersInput;
    isDefault: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault) {
        await tx.adminSessionFilterPreset.updateMany({
          where: {
            adminId: params.adminId,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }

      return tx.adminSessionFilterPreset.create({
        data: {
          adminId: params.adminId,
          name: params.name,
          ...toDbFields(params.filters),
          isDefault: params.isDefault
        }
      });
    }),

  update: (params: {
    adminId: string;
    presetId: string;
    name?: string;
    filters?: SessionPresetFiltersInput;
    isDefault?: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault === true) {
        await tx.adminSessionFilterPreset.updateMany({
          where: {
            adminId: params.adminId,
            isDefault: true,
            id: {
              not: params.presetId
            }
          },
          data: {
            isDefault: false
          }
        });
      }

      return tx.adminSessionFilterPreset.update({
        where: {
          id: params.presetId
        },
        data: {
          name: params.name,
          ...(params.filters ? toDbFields(params.filters) : {}),
          isDefault: params.isDefault
        }
      });
    }),

  removeById: (adminId: string, presetId: string) =>
    prisma.adminSessionFilterPreset.deleteMany({
      where: {
        id: presetId,
        adminId
      }
    })
};
