import { prisma } from "@/lib/prisma";
import { ContentStatus, Prisma } from "@prisma/client";

export const contentRepository = {
  buildWhere: (params: { search?: string; status?: ContentStatus }): Prisma.ContentPostWhereInput => ({
    status: params.status,
    OR: params.search
      ? [
          {
            title: {
              contains: params.search,
              mode: "insensitive"
            }
          },
          {
            slug: {
              contains: params.search,
              mode: "insensitive"
            }
          }
        ]
      : undefined
  }),

  list: (params: { skip: number; take: number; search?: string; status?: ContentStatus }) =>
    prisma.contentPost.findMany({
      where: contentRepository.buildWhere(params),
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" }
    }),

  count: (params: { search?: string; status?: ContentStatus }) =>
    prisma.contentPost.count({
      where: contentRepository.buildWhere(params)
    }),

  countByStatus: async (params: { search?: string }) => {
    const where = contentRepository.buildWhere({ search: params.search });

    const [draft, published, archived] = await Promise.all([
      prisma.contentPost.count({ where: { ...where, status: "DRAFT" } }),
      prisma.contentPost.count({ where: { ...where, status: "PUBLISHED" } }),
      prisma.contentPost.count({ where: { ...where, status: "ARCHIVED" } })
    ]);

    return {
      DRAFT: draft,
      PUBLISHED: published,
      ARCHIVED: archived,
      total: draft + published + archived
    };
  },

  listForExport: (params: { take: number; search?: string; status?: ContentStatus }) =>
    prisma.contentPost.findMany({
      where: contentRepository.buildWhere({
        search: params.search,
        status: params.status
      }),
      take: params.take,
      orderBy: { createdAt: "desc" }
    }),

  findById: (id: string) =>
    prisma.contentPost.findUnique({
      where: { id }
    }),

  findBySlug: (slug: string) =>
    prisma.contentPost.findUnique({
      where: { slug }
    }),

  findManyByIds: (ids: string[]) =>
    prisma.contentPost.findMany({
      where: {
        id: {
          in: ids
        }
      }
    }),

  create: (data: { slug: string; title: string; content: string; status: ContentStatus }) =>
    prisma.contentPost.create({ data }),

  update: (id: string, data: Prisma.ContentPostUpdateInput) =>
    prisma.contentPost.update({
      where: { id },
      data
    }),

  updateStatus: (id: string, status: ContentStatus) =>
    prisma.contentPost.update({
      where: { id },
      data: {
        status
      }
    })
};
