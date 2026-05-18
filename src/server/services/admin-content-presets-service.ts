import { ContentStatus, Prisma } from "@prisma/client";
import { auditRepository } from "@/server/repositories/audit-repository";
import { adminContentFilterPresetRepository } from "@/server/repositories/admin-content-filter-preset-repository";
import { AppError } from "@/server/utils/errors";

const normalizeContentPresetFilters = (filters: {
  search?: string;
  status?: ContentStatus;
}) => ({
  search: filters.search?.trim() ? filters.search.trim() : undefined,
  status: filters.status
});

const mapContentPreset = (preset: {
  id: string;
  name: string;
  search: string | null;
  status: ContentStatus | null;
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
    search: preset.search ?? undefined,
    status: preset.status ?? undefined
  }
});

const isPrismaUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export const adminContentPresetsService = {
  list: async (adminId: string) => {
    const presets = await adminContentFilterPresetRepository.listByAdminId(adminId);
    return presets.map((preset) => mapContentPreset(preset));
  },

  create: async (
    adminId: string,
    payload: {
      name: string;
      filters: {
        search?: string;
        status?: ContentStatus;
      };
      isDefault: boolean;
    }
  ) => {
    try {
      const created = await adminContentFilterPresetRepository.create({
        adminId,
        name: payload.name.trim(),
        filters: normalizeContentPresetFilters(payload.filters),
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "CONTENT_FILTER_PRESET_CREATE",
        targetType: "CONTENT_FILTER_PRESET",
        targetId: created.id,
        details: {
          name: created.name,
          isDefault: created.isDefault
        }
      });

      return mapContentPreset(created);
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
        search?: string;
        status?: ContentStatus;
      };
      isDefault?: boolean;
    }
  ) => {
    const existing = await adminContentFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    try {
      const updated = await adminContentFilterPresetRepository.update({
        adminId,
        presetId,
        name: payload.name?.trim(),
        filters: payload.filters ? normalizeContentPresetFilters(payload.filters) : undefined,
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "CONTENT_FILTER_PRESET_UPDATE",
        targetType: "CONTENT_FILTER_PRESET",
        targetId: updated.id,
        details: {
          beforeName: existing.name,
          afterName: updated.name,
          beforeIsDefault: existing.isDefault,
          afterIsDefault: updated.isDefault
        }
      });

      return mapContentPreset(updated);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  delete: async (adminId: string, presetId: string) => {
    const existing = await adminContentFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    await adminContentFilterPresetRepository.removeById(adminId, presetId);
    await auditRepository.logAdminAction({
      adminId,
      action: "CONTENT_FILTER_PRESET_DELETE",
      targetType: "CONTENT_FILTER_PRESET",
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
