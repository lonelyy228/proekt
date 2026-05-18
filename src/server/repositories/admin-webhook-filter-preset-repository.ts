import { prisma } from "@/lib/prisma";

type WebhookPresetFiltersInput = {
  eventType?: string;
  processed?: boolean;
};

const toDbFields = (filters: WebhookPresetFiltersInput) => ({
  eventType: filters.eventType ?? null,
  processed: filters.processed ?? null
});

export const adminWebhookFilterPresetRepository = {
  listByAdminId: (adminId: string) =>
    prisma.adminWebhookFilterPreset.findMany({
      where: {
        adminId
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),

  findByIdForAdmin: (adminId: string, presetId: string) =>
    prisma.adminWebhookFilterPreset.findFirst({
      where: {
        id: presetId,
        adminId
      }
    }),

  create: (params: {
    adminId: string;
    name: string;
    filters: WebhookPresetFiltersInput;
    isDefault: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault) {
        await tx.adminWebhookFilterPreset.updateMany({
          where: {
            adminId: params.adminId,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }

      return tx.adminWebhookFilterPreset.create({
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
    filters?: WebhookPresetFiltersInput;
    isDefault?: boolean;
  }) =>
    prisma.$transaction(async (tx) => {
      if (params.isDefault === true) {
        await tx.adminWebhookFilterPreset.updateMany({
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

      return tx.adminWebhookFilterPreset.update({
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
    prisma.adminWebhookFilterPreset.deleteMany({
      where: {
        id: presetId,
        adminId
      }
    })
};
