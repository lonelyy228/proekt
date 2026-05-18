import { designRepository } from "@/server/repositories/design-repository";
import { assertValidImageMeta } from "@/server/utils/image-validation";
import { Prisma } from "@prisma/client";

export const designService = {
  create: async (userId: string, payload: {
    garmentType: "TSHIRT" | "HOODIE" | "SWEATSHIRT";
    garmentColor: string;
    canvasJson: { version: string; objects: Array<Record<string, unknown>> };
    previewUrl: string;
    previewWidth: number;
    previewHeight: number;
  }) => {
    assertValidImageMeta("image/webp", payload.previewWidth * payload.previewHeight > 0 ? 1024 : 0);

    return designRepository.createDesign({
      user: { connect: { id: userId } },
      garmentType: payload.garmentType,
      garmentColor: payload.garmentColor,
      canvasJson: payload.canvasJson as Prisma.InputJsonValue,
      previewUrl: payload.previewUrl,
      previewWidth: payload.previewWidth,
      previewHeight: payload.previewHeight
    });
  },

  listByUser: (userId: string) => designRepository.listByUserId(userId)
};
