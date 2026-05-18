import { NextRequest } from "next/server";
import { authService } from "@/server/services/auth-service";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { getRefreshCookie, setAccessCookie, setRefreshCookie } from "@/server/utils/cookies";
import { issueCsrfCookie } from "@/server/utils/csrf";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { authLimiter } from "@/server/utils/limiters";
import { AppError } from "@/server/utils/errors";

export async function POST(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    await enforceRateLimit(authLimiter, _request.ip ?? "unknown");
    const refreshToken = getRefreshCookie();
    if (!refreshToken) {
      throw new AppError("AUTH_ERROR", "Missing refresh token");
    }

    const result = await authService.refreshSession(refreshToken);

    setAccessCookie(result.accessToken);
    setRefreshCookie(result.refreshToken);
    const csrfToken = issueCsrfCookie();

    return apiSuccess({ user: result.user, csrfToken }, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
