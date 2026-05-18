import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { issueCsrfCookie } from "@/server/utils/csrf";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    await requireAuth();
    const csrfToken = issueCsrfCookie();
    return apiSuccess({ csrfToken }, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
