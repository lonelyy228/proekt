import { uploadConfig } from "@/config/constants";
import { AppError } from "@/server/utils/errors";

export const assertValidImageMeta = (mimeType: string, sizeInBytes: number): void => {
  const allowedMimeTypes = new Set<string>(uploadConfig.allowedMimeTypes as readonly string[]);

  if (!allowedMimeTypes.has(mimeType)) {
    throw new AppError("VALIDATION_ERROR", "Unsupported image file type");
  }

  if (sizeInBytes > uploadConfig.maxImageSizeBytes) {
    throw new AppError("VALIDATION_ERROR", "Image file exceeds maximum size");
  }
};
