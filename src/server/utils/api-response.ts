import { NextResponse } from "next/server";
import { isAppError } from "@/server/utils/errors";
import { logger } from "@/lib/logger";
import { ZodError } from "zod";
import { localizeAppErrorMessage, localizeErrorCodeMessage } from "@/server/utils/error-localization";

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

export const apiSuccess = <T>(data: T, requestId?: string): NextResponse =>
  NextResponse.json(
    {
      success: true,
      data,
      requestId
    },
    { status: 200 }
  );

export const apiError = (error: unknown, requestId?: string): NextResponse => {
  if (error instanceof ZodError) {
    return NextResponse.json(
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
      { status: 422 }
    );
  }

  if (isAppError(error)) {
    const localizedMessage = localizeAppErrorMessage(error.code, error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: localizedMessage,
          details: error.details
        },
        requestId
      },
      { status: statusByCode[error.code] ?? 500 }
    );
  }

  logger.error({ err: error, requestId }, "Unhandled API error");
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: localizeErrorCodeMessage("INTERNAL_ERROR")
      },
      requestId
    },
    { status: 500 }
  );
};
