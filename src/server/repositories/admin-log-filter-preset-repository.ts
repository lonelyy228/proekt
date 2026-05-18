import { prisma } from "@/lib/prisma";

type LogPresetFiltersInput = {
  action?: string;
  targetType?: string;
  search?: string;
};

const toDbFields = (filters: LogPresetFiltersInput) => ({
  action: filters.action ?? null,
  targetType: filters.targetType ?? null,
  search: filters.search ?? null
});

export const adminLogFilterPresetRepository = {
  listByAdminId: (adminId: string) =>
    prisma.adminLogFilterPreset.findMany({
      where: {
        adminId
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),

  findByIdForAdmin: (adminId: string, presetId: string) =>
    prisma.adminLogFilterPreset.findFirst({
      where: {
        id: presetId,
        adminId
      }
    }),

  create: (params: {
    adminId: string;
    name: string;
    filters: LogPresetFiltersInput;
    isDefault: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault) {
        await tx.adminLogFilterPreset.updateMany({
          where: {
            adminId: params.adminId,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }

      return tx.adminLogFilterPreset.create({
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
    filters?: LogPresetFiltersInput;
    isDefault?: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault === true) {
        await tx.adminLogFilterPreset.updateMany({
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

      return tx.adminLogFilterPreset.update({
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
    prisma.adminLogFilterPreset.deleteMany({
      where: {
        id: presetId,
        adminId
      }
    })
};
