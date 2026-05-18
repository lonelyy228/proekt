import { NextRequest } from "next/server";
import { authService } from "@/server/services/auth-service";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { clearAuthCookies, getRefreshCookie } from "@/server/utils/cookies";
import { assertValidCsrf } from "@/server/utils/csrf";

export async function POST(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    assertValidCsrf();
    const refreshToken = getRefreshCookie();
    await authService.logout(refreshToken);
    clearAuthCookies();
    return apiSuccess({ success: true }, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
