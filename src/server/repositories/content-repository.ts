import { prisma } from "@/lib/prisma";
import { ContentStatus, Prisma } from "@prisma/client";

export const contentRepository = {
  list: (params: { skip: number; take: number; search?: string; status?: ContentStatus }) =>
    prisma.contentPost.findMany({
      where: {
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
      },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" }
    }),

  count: (params: { search?: string; status?: ContentStatus }) =>
    prisma.contentPost.count({
      where: {
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
      }
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
