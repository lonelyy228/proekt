import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";

type ProductPresetFiltersInput = {
  search?: string;
  brand?: string;
  categoryId?: string;
  status?: ProductStatus;
  sortBy?: "newest" | "price_asc" | "price_desc" | "name_asc";
};

const toDbFields = (filters: ProductPresetFiltersInput) => ({
  search: filters.search ?? null,
  brand: filters.brand ?? null,
  categoryId: filters.categoryId ?? null,
  status: filters.status ?? null,
  sortBy: filters.sortBy ?? null
});

export const adminProductFilterPresetRepository = {
  listByAdminId: (adminId: string) =>
    prisma.adminProductFilterPreset.findMany({
      where: {
        adminId
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),

  findByIdForAdmin: (adminId: string, presetId: string) =>
    prisma.adminProductFilterPreset.findFirst({
      where: {
        id: presetId,
        adminId
      }
    }),

  create: (params: {
    adminId: string;
    name: string;
    filters: ProductPresetFiltersInput;
    isDefault: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault) {
        await tx.adminProductFilterPreset.updateMany({
          where: {
            adminId: params.adminId,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }

      return tx.adminProductFilterPreset.create({
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
    filters?: ProductPresetFiltersInput;
    isDefault?: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault === true) {
        await tx.adminProductFilterPreset.updateMany({
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

      return tx.adminProductFilterPreset.update({
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
    prisma.adminProductFilterPreset.deleteMany({
      where: {
        id: presetId,
        adminId
      }
    })
};
