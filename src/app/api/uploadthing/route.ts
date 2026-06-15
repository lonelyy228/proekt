import { NextRequest, NextResponse } from "next/server";
import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "@/app/api/uploadthing/core";
import { env } from "@/config/env";

const uploadthingHandlers = createRouteHandler({
  router: uploadRouter
});

const uploadthingDisabledResponse = (): Response =>
  NextResponse.json(
    {
      success: false,
      error: {
        code: "UPLOAD_PROVIDER_DISABLED",
        message: "UploadThing route is disabled for the current upload provider"
      }
    },
    { status: 503 }
  );

export async function GET(request: NextRequest): Promise<Response> {
  if (env.UPLOAD_PROVIDER !== "uploadthing") {
    return uploadthingDisabledResponse();
  }

  return uploadthingHandlers.GET(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  if (env.UPLOAD_PROVIDER !== "uploadthing") {
    return uploadthingDisabledResponse();
  }

  return uploadthingHandlers.POST(request);
}
