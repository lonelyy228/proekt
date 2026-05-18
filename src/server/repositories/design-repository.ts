import { prisma } from "@/lib/prisma";

export const designRepository = {
  createDesign: (data: Parameters<typeof prisma.customizationDesign.create>[0]["data"]) =>
    prisma.customizationDesign.create({ data }),

  updateDesign: (id: string, userId: string, data: Parameters<typeof prisma.customizationDesign.update>[0]["data"]) =>
    prisma.customizationDesign.update({
      where: { id, userId },
      data
    }),

  findById: (id: string, userId: string) =>
    prisma.customizationDesign.findFirst({
      where: { id, userId }
    }),

  listByUserId: (userId: string) =>
    prisma.customizationDesign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    })
};
