import { prisma } from "@/lib/prisma";
import { OrderStatus, Prisma } from "@prisma/client";

type PresetFiltersInput = {
  search?: string;
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  minTotalCents?: number;
  maxTotalCents?: number;
};

const toDbFields = (filters: PresetFiltersInput) => ({
  search: filters.search ?? null,
  status: filters.status ?? null,
  dateFrom: filters.dateFrom ?? null,
  dateTo: filters.dateTo ?? null,
  minTotalCents: filters.minTotalCents ?? null,
  maxTotalCents: filters.maxTotalCents ?? null
});

const toUpdateData = (filters: PresetFiltersInput): Prisma.AdminOrderFilterPresetUpdateInput => ({
  ...toDbFields(filters)
});

export const adminOrderFilterPresetRepository = {
  listByAdminId: (adminId: string) =>
    prisma.adminOrderFilterPreset.findMany({
      where: {
        adminId
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),

  findByIdForAdmin: (adminId: string, presetId: string) =>
    prisma.adminOrderFilterPreset.findFirst({
      where: {
        id: presetId,
        adminId
      }
    }),

  create: (params: {
    adminId: string;
    name: string;
    filters: PresetFiltersInput;
    isDefault: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault) {
        await tx.adminOrderFilterPreset.updateMany({
          where: {
            adminId: params.adminId,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }

      return tx.adminOrderFilterPreset.create({
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
    filters?: PresetFiltersInput;
    isDefault?: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault === true) {
        await tx.adminOrderFilterPreset.updateMany({
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

      return tx.adminOrderFilterPreset.update({
        where: {
          id: params.presetId
        },
        data: {
          name: params.name,
          ...(params.filters ? toUpdateData(params.filters) : {}),
          isDefault: params.isDefault
        }
      });
    }),

  removeById: (adminId: string, presetId: string) =>
    prisma.adminOrderFilterPreset.deleteMany({
      where: {
        id: presetId,
        adminId
      }
    })
};
