"use client";

import { genUploader } from "uploadthing/client";
import type { UploadRouter } from "@/app/api/uploadthing/core";

const uploader = genUploader<UploadRouter>({
  url: "/api/uploadthing"
});

export const uploadDesignAsset = async (file: File): Promise<string> => {
  const [result] = await uploader.uploadFiles("designAssetUploader", { files: [file] });

  if (!result) {
    throw new Error("Upload failed: no file returned");
  }

  return result.ufsUrl;
};
