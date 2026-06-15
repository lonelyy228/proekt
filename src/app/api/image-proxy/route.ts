import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/server/utils/errors";
import { apiError } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

const buildProxyHeaders = (contentType: string, contentLength?: string | null): Headers => {
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");

  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return headers;
};

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const rawUrl = request.nextUrl.searchParams.get("url")?.trim();
    if (!rawUrl) {
      throw new AppError("VALIDATION_ERROR", "Image URL is required");
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      throw new AppError("VALIDATION_ERROR", "Image URL is invalid");
    }

    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      throw new AppError("VALIDATION_ERROR", "Only http(s) image URLs are supported");
    }

    const response = await fetch(targetUrl, {
      headers: {
        Accept: "image/*"
      },
      redirect: "follow",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new AppError("EXTERNAL_PROVIDER_ERROR", `Remote image request failed with ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new AppError("VALIDATION_ERROR", "Remote URL does not point to a supported image");
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Remote image exceeds the 8 MB limit");
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Remote image exceeds the 8 MB limit");
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: buildProxyHeaders(contentType, response.headers.get("content-length"))
    });
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
