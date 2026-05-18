import { Prisma, SessionStatus } from "@prisma/client";
import { auditRepository } from "@/server/repositories/audit-repository";
import { adminSessionFilterPresetRepository } from "@/server/repositories/admin-session-filter-preset-repository";
import { AppError } from "@/server/utils/errors";

const normalizeSessionPresetFilters = (filters: {
  search?: string;
  status?: SessionStatus;
}) => ({
  search: filters.search?.trim() ? filters.search.trim() : undefined,
  status: filters.status
});

const mapSessionPreset = (preset: {
  id: string;
  name: string;
  search: string | null;
  status: SessionStatus | null;
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

export const adminSessionPresetsService = {
  list: async (adminId: string) => {
    const presets = await adminSessionFilterPresetRepository.listByAdminId(adminId);
    return presets.map((preset) => mapSessionPreset(preset));
  },

  create: async (
    adminId: string,
    payload: {
      name: string;
      filters: {
        search?: string;
        status?: SessionStatus;
      };
      isDefault: boolean;
    }
  ) => {
    try {
      const created = await adminSessionFilterPresetRepository.create({
        adminId,
        name: payload.name.trim(),
        filters: normalizeSessionPresetFilters(payload.filters),
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "SESSION_FILTER_PRESET_CREATE",
        targetType: "SESSION_FILTER_PRESET",
        targetId: created.id,
        details: {
          name: created.name,
          isDefault: created.isDefault
        }
      });

      return mapSessionPreset(created);
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
        status?: SessionStatus;
      };
      isDefault?: boolean;
    }
  ) => {
    const existing = await adminSessionFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    try {
      const updated = await adminSessionFilterPresetRepository.update({
        adminId,
        presetId,
        name: payload.name?.trim(),
        filters: payload.filters ? normalizeSessionPresetFilters(payload.filters) : undefined,
        isDefault: payload.isDefault
      });

      await auditRepository.logAdminAction({
        adminId,
        action: "SESSION_FILTER_PRESET_UPDATE",
        targetType: "SESSION_FILTER_PRESET",
        targetId: updated.id,
        details: {
          beforeName: existing.name,
          afterName: updated.name,
          beforeIsDefault: existing.isDefault,
          afterIsDefault: updated.isDefault
        }
      });

      return mapSessionPreset(updated);
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Пресет с таким названием уже существует");
      }
      throw error;
    }
  },

  delete: async (adminId: string, presetId: string) => {
    const existing = await adminSessionFilterPresetRepository.findByIdForAdmin(adminId, presetId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Пресет не найден");
    }

    await adminSessionFilterPresetRepository.removeById(adminId, presetId);
    await auditRepository.logAdminAction({
      adminId,
      action: "SESSION_FILTER_PRESET_DELETE",
      targetType: "SESSION_FILTER_PRESET",
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
