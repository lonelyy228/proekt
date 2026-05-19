import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { isAppError } from "@/server/utils/errors";
import { localizeAppErrorMessage, localizeErrorCodeMessage } from "@/server/utils/error-localization";
import { captureServerError } from "@/server/utils/sentry";

const statusByCode: Record<string, number> = {
  VALIDATION_ERROR: 422,
  AUTH_ERROR: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  EXTERNAL_PROVIDER_ERROR: 502,
  INTERNAL_ERROR: 500
};

const buildResponse = <T>(payload: T, status: number, requestId?: string): NextResponse => {
  const response = NextResponse.json(payload, { status });
  if (requestId) {
    response.headers.set("x-request-id", requestId);
  }
  return response;
};

const readRouteContext = (): { endpoint?: string; method?: string; area?: "api" | "webhook" | "admin" } => {
  const requestHeaders = headers();
  const endpoint = requestHeaders.get("x-rsh-pathname") ?? undefined;
  const method = requestHeaders.get("x-rsh-method") ?? undefined;

  if (!endpoint || !endpoint.startsWith("/api/")) {
    return { endpoint, method, area: undefined };
  }

  if (endpoint === "/api/webhooks/stripe" || endpoint.startsWith("/api/admin/webhooks/stripe")) {
    return { endpoint, method, area: "webhook" };
  }

  if (endpoint.startsWith("/api/admin/")) {
    return { endpoint, method, area: "admin" };
  }

  return { endpoint, method, area: "api" };
};

export const apiSuccess = <T>(data: T, requestId?: string): NextResponse =>
  buildResponse(
    {
      success: true,
      data,
      requestId
    },
    200,
    requestId
  );

export const apiError = (error: unknown, requestId?: string): NextResponse => {
  const routeContext = readRouteContext();

  if (error instanceof ZodError) {
    return buildResponse(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: localizeErrorCodeMessage("VALIDATION_ERROR"),
          details: error.issues.map((issue) => {
            const path = issue.path.join(".");
            return path ? `${path}: ${issue.message}` : issue.message;
          })
        },
        requestId
      },
      422,
      requestId
    );
  }

  if (isAppError(error)) {
    const localizedMessage = localizeAppErrorMessage(error.code, error.message);
    const status = statusByCode[error.code] ?? 500;

    if (status >= 500) {
      captureServerError(error, { ...routeContext, requestId }, "AppError surfaced to API response");
    }

    return buildResponse(
      {
        success: false,
        error: {
          code: error.code,
          message: localizedMessage,
          details: error.details
        },
        requestId
      },
      status,
      requestId
    );
  }

  logger.error({ err: error, requestId, ...routeContext }, "Unhandled API error");
  captureServerError(error, { ...routeContext, requestId }, "Unhandled API error");

  return buildResponse(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: localizeErrorCodeMessage("INTERNAL_ERROR")
      },
      requestId
    },
    500,
    requestId
  );
};
