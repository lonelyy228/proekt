import { Prisma } from "@prisma/client";
import { auditRepository } from "@/server/repositories/audit-repository";
import { adminLogFilterPresetRepository } from "@/server/repositories/admin-log-filter-preset-repository";
import { AppError } from "@/server/utils/errors";

const normalizeLogPresetFilters = (filters: {
  action?: string;
  targetType?: string;
  search?: string;
}) => ({
  action: filters.action?.trim() ? filters.action.trim() : undefined,
  targetType: filters.targetType?.trim() ? filters.targetType.trim() : undefined,
  search: filters.search?.trim() ? filters.search.trim() : undefined
});

const mapLogPreset = (preset: {
  id: string;
  name: string;
  action: string | null;
  targetType: string | null;
  search: string | null;
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
    action: preset.action ?? undefined,
    targetType: preset.targetType ?? undefined,
    search: preset.search ?? undefined
  }
});

const isPrismaUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export const adminLogPresetsService = {
  list: async (adminId: string) => {
    const presets = await adminLogFilterPresetRepository.listByAdminId(adminId);
    return presets.map((preset) => mapLogPreset(preset));
  },

  create: async (
    adminId: string,
    payload: {
      name: string;
      filters: {
        action?: string;
        targetType?: string;
        search?: string;
      };
      isDefault: boolean;
    }
  ) => {
    try {
      const created = await adminLogFilterPresetRepository.create({
        adminId,
        name: payload.name.trim(),
        filters: normalizeLogPresetFilters(payload.filters),
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "ADMIN_LOG_FILTER_PRESET_CREATE",
        targetType: "ADMIN_LOG_FILTER_PRESET",
        targetId: created.id,
        details: {
          name: created.name,
          isDefault: created.isDefault
        }
      });

      return mapLogPreset(created);
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
        action?: string;
        targetType?: string;
        search?: string;
      };
      isDefault?: boolean;
    }
  ) => {
    const existing = await adminLogFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    try {
      const updated = await adminLogFilterPresetRepository.update({
        adminId,
        presetId,
        name: payload.name?.trim(),
        filters: payload.filters ? normalizeLogPresetFilters(payload.filters) : undefined,
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "ADMIN_LOG_FILTER_PRESET_UPDATE",
        targetType: "ADMIN_LOG_FILTER_PRESET",
        targetId: updated.id,
        details: {
          beforeName: existing.name,
          afterName: updated.name,
          beforeIsDefault: existing.isDefault,
          afterIsDefault: updated.isDefault
        }
      });

      return mapLogPreset(updated);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  delete: async (adminId: string, presetId: string) => {
    const existing = await adminLogFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    await adminLogFilterPresetRepository.removeById(adminId, presetId);
    await auditRepository.logAdminAction({
      adminId,
      action: "ADMIN_LOG_FILTER_PRESET_DELETE",
      targetType: "ADMIN_LOG_FILTER_PRESET",
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
