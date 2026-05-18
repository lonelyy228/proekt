import { ContentStatus } from "@prisma/client";
import { contentRepository } from "@/server/repositories/content-repository";
import { sanitizeText } from "@/server/utils/sanitize";
import { auditRepository } from "@/server/repositories/audit-repository";
import { AppError } from "@/server/utils/errors";

export const contentService = {
  list: async (params: { page: number; pageSize: number; search?: string; status?: ContentStatus }) => {
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      contentRepository.list({
        skip,
        take: params.pageSize,
        search: params.search ? sanitizeText(params.search) : undefined,
        status: params.status
      }),
      contentRepository.count({
        search: params.search ? sanitizeText(params.search) : undefined,
        status: params.status
      })
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  create: async (
    adminId: string,
    payload: {
      slug: string;
      title: string;
      content: string;
      status: ContentStatus;
    }
  ) => {
    const existingBySlug = await contentRepository.findBySlug(payload.slug);
    if (existingBySlug) {
      throw new AppError("CONFLICT", "Публикация с таким slug уже существует");
    }

    const post = await contentRepository.create({
      slug: payload.slug,
      title: sanitizeText(payload.title),
      content: sanitizeText(payload.content),
      status: payload.status
    });

    await auditRepository.logAdminAction({
      adminId,
      action: "CONTENT_CREATE",
      targetType: "CONTENT_POST",
      targetId: post.id,
      details: { slug: post.slug }
    });

    return post;
  },

  update: async (
    adminId: string,
    postId: string,
    payload: {
      slug?: string;
      title?: string;
      content?: string;
      status?: ContentStatus;
    }
  ) => {
    const existing = await contentRepository.findById(postId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Публикация не найдена");
    }

    if (payload.slug && payload.slug !== existing.slug) {
      const existingBySlug = await contentRepository.findBySlug(payload.slug);
      if (existingBySlug && existingBySlug.id !== postId) {
        throw new AppError("CONFLICT", "Публикация с таким slug уже существует");
      }
    }

    const updated = await contentRepository.update(postId, {
      slug: payload.slug,
      title: payload.title ? sanitizeText(payload.title) : undefined,
      content: payload.content ? sanitizeText(payload.content) : undefined,
      status: payload.status
    });

    await auditRepository.logAdminAction({
      adminId,
      action: "CONTENT_UPDATE",
      targetType: "CONTENT_POST",
      targetId: postId,
      details: {
        beforeSlug: existing.slug,
        afterSlug: updated.slug,
        beforeStatus: existing.status,
        afterStatus: updated.status
      }
    });

    return updated;
  },

  updateStatusesBulk: async (
    adminId: string,
    params: {
      postIds: string[];
      status: ContentStatus;
      dryRun: boolean;
    }
  ) => {
    const uniquePostIds = Array.from(new Set(params.postIds));
    const posts = await contentRepository.findManyByIds(uniquePostIds);

    const foundIds = new Set(posts.map((post) => post.id));
    const missingPostIds = uniquePostIds.filter((postId) => !foundIds.has(postId));
    if (missingPostIds.length > 0) {
      throw new AppError("NOT_FOUND", `Не найдены публикации: ${missingPostIds.join(", ")}`);
    }

    const evaluated = posts.map((post) => {
      if (post.status === params.status) {
        return {
          postId: post.id,
          slug: post.slug,
          fromStatus: post.status,
          toStatus: params.status,
          canUpdate: false,
          reason: "Публикация уже имеет выбранный статус"
        } as const;
      }

      return {
        postId: post.id,
        slug: post.slug,
        fromStatus: post.status,
        toStatus: params.status,
        canUpdate: true,
        reason: null
      } as const;
    });

    const eligible = evaluated.filter((item) => item.canUpdate);
    const rejected = evaluated.filter((item) => !item.canUpdate);

    if (params.dryRun) {
      return {
        dryRun: true,
        requestedCount: uniquePostIds.length,
        eligibleCount: eligible.length,
        rejectedCount: rejected.length,
        eligible,
        rejected
      };
    }

    if (eligible.length === 0) {
      throw new AppError("CONFLICT", "Нет публикаций, подходящих для обновления статуса");
    }

    await Promise.all(
      eligible.map((item) =>
        contentRepository.updateStatus(item.postId, params.status)
      )
    );

    await Promise.all(
      eligible.map((item) =>
        auditRepository.logAdminAction({
          adminId,
          action: "CONTENT_UPDATE",
          targetType: "CONTENT_POST",
          targetId: item.postId,
          details: {
            beforeStatus: item.fromStatus,
            afterStatus: item.toStatus,
            source: "bulk"
          }
        })
      )
    );

    await auditRepository.logAdminAction({
      adminId,
      action: "CONTENT_STATUS_BULK_UPDATE",
      targetType: "CONTENT_POST",
      targetId: "bulk",
      details: {
        requestedCount: uniquePostIds.length,
        updatedCount: eligible.length,
        rejectedCount: rejected.length,
        targetStatus: params.status
      }
    });

    return {
      dryRun: false,
      requestedCount: uniquePostIds.length,
      updatedCount: eligible.length,
      rejectedCount: rejected.length,
      updatedPostIds: eligible.map((item) => item.postId),
      rejected
    };
  }
};
