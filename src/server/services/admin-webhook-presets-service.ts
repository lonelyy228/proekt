import { Prisma } from "@prisma/client";
import { auditRepository } from "@/server/repositories/audit-repository";
import { adminWebhookFilterPresetRepository } from "@/server/repositories/admin-webhook-filter-preset-repository";
import { AppError } from "@/server/utils/errors";

const normalizeWebhookPresetFilters = (filters: {
  eventType?: string;
  processed?: boolean;
}) => ({
  eventType: filters.eventType?.trim() ? filters.eventType.trim() : undefined,
  processed: filters.processed
});

const mapWebhookPreset = (preset: {
  id: string;
  name: string;
  eventType: string | null;
  processed: boolean | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: preset.id,
  name: preset.name,
  isDefault: preset.isDefault,
  createdAt: preset.createdAt,
  updatedAt: preset.updatedAt,
  filters: {
    eventType: preset.eventType ?? undefined,
    processed: preset.processed ?? undefined
  }
});

const isPrismaUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export const adminWebhookPresetsService = {
  list: async (adminId: string) => {
    const presets = await adminWebhookFilterPresetRepository.listByAdminId(adminId);
    return presets.map((preset) => mapWebhookPreset(preset));
  },

  create: async (
    adminId: string,
    payload: {
      name: string;
      filters: {
        eventType?: string;
        processed?: boolean;
      };
      isDefault: boolean;
    }
  ) => {
    try {
      const created = await adminWebhookFilterPresetRepository.create({
        adminId,
        name: payload.name.trim(),
        filters: normalizeWebhookPresetFilters(payload.filters),
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "WEBHOOK_FILTER_PRESET_CREATE",
        targetType: "WEBHOOK_FILTER_PRESET",
        targetId: created.id,
        details: {
          name: created.name,
          isDefault: created.isDefault
        }
      });

      return mapWebhookPreset(created);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  update: async (
    adminId: string,
    presetId: string,
    payload: {
      name?: string;
      filters?: {
        eventType?: string;
        processed?: boolean;
      };
      isDefault?: boolean;
    }
  ) => {
    const existing = await adminWebhookFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    try {
      const updated = await adminWebhookFilterPresetRepository.update({
        adminId,
        presetId,
        name: payload.name?.trim(),
        filters: payload.filters ? normalizeWebhookPresetFilters(payload.filters) : undefined,
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "WEBHOOK_FILTER_PRESET_UPDATE",
        targetType: "WEBHOOK_FILTER_PRESET",
        targetId: updated.id,
        details: {
          beforeName: existing.name,
          afterName: updated.name,
          beforeIsDefault: existing.isDefault,
          afterIsDefault: updated.isDefault
        }
      });

      return mapWebhookPreset(updated);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  delete: async (adminId: string, presetId: string) => {
    const existing = await adminWebhookFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    await adminWebhookFilterPresetRepository.removeById(adminId, presetId);
    await auditRepository.logAdminAction({
      adminId,
      action: "WEBHOOK_FILTER_PRESET_DELETE",
      targetType: "WEBHOOK_FILTER_PRESET",
      targetId: presetId,
      details: {
        name: existing.name,
        isDefault: existing.isDefault
      }
    });

    return {
      deleted: true
    };
  }
};
