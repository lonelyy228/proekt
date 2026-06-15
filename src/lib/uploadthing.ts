import { UTApi } from "uploadthing/server";
import { env } from "@/config/env";

export const utapi =
  env.UPLOAD_PROVIDER === "uploadthing" && env.UPLOADTHING_TOKEN
    ? new UTApi({
        token: env.UPLOADTHING_TOKEN,
        apiUrl: "https://uploadthing.com/api"
      })
    : null;
