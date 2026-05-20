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

export const assertValidImageDimensions = (width: number, height: number): void => {
  if (width > uploadConfig.maxImageDimensionPx || height > uploadConfig.maxImageDimensionPx) {
    throw new AppError("VALIDATION_ERROR", "Image dimensions exceed maximum limit");
  }

  if (width * height > uploadConfig.maxImagePixels) {
    throw new AppError("VALIDATION_ERROR", "Image pixel count exceeds maximum limit");
  }
};

export const isTrustedAssetUrl = (rawUrl: string): boolean => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsedUrl.protocol !== "https:") {
    return false;
  }

  const host = parsedUrl.hostname.toLowerCase();

  return uploadConfig.trustedAssetHosts.some((trustedHost) => {
    const normalizedTrustedHost = trustedHost.toLowerCase();
    return host === normalizedTrustedHost || host.endsWith(`.${normalizedTrustedHost}`);
  });
};

export const assertTrustedAssetUrl = (rawUrl: string): void => {
  if (!isTrustedAssetUrl(rawUrl)) {
    throw new AppError("VALIDATION_ERROR", "Image URL is not from a trusted storage host");
  }
};
