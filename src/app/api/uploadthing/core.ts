import { createUploadthing, type FileRouter } from "uploadthing/next";
import { requireAuth } from "@/server/utils/require-auth";
import { assertValidImageMeta } from "@/server/utils/image-validation";

const f = createUploadthing();

export const uploadRouter = {
  designAssetUploader: f({
    "image/png": {
      maxFileSize: "8MB",
      maxFileCount: 5
    },
    "image/jpeg": {
      maxFileSize: "8MB",
      maxFileCount: 5
    },
    "image/webp": {
      maxFileSize: "8MB",
      maxFileCount: 5
    }
  })
    .middleware(async () => {
      const user = await requireAuth();
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      assertValidImageMeta(file.type, file.size);

      return {
        uploadedBy: metadata.userId,
        fileUrl: file.ufsUrl,
        mimeType: file.type,
        size: file.size
      };
    })
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
