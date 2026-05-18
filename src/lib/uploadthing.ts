import { UTApi } from "uploadthing/server";
import { env } from "@/config/env";

export const utapi = new UTApi({
  token: env.UPLOADTHING_TOKEN,
  apiUrl: "https://uploadthing.com/api"
});
