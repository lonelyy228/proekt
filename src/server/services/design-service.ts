import { designRepository } from "@/server/repositories/design-repository";
import { assertTrustedAssetUrl, assertValidImageDimensions } from "@/server/utils/image-validation";
import { Prisma } from "@prisma/client";
import { CustomizerGarmentType } from "@/config/customizer";

export const designService = {
  create: async (userId: string, payload: {
    garmentType: CustomizerGarmentType;
    garmentColor: string;
    canvasJson: { version: string; objects: Array<Record<string, unknown>> };
    previewUrl: string;
    previewWidth: number;
    previewHeight: number;
  }) => {
    assertTrustedAssetUrl(payload.previewUrl);
    assertValidImageDimensions(payload.previewWidth, payload.previewHeight);

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
