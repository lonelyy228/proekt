import { NextRequest } from "next/server";
import { loginSchema } from "@/server/validators/auth";
import { authService } from "@/server/services/auth-service";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { setAccessCookie, setRefreshCookie } from "@/server/utils/cookies";
import { issueCsrfCookie } from "@/server/utils/csrf";
import { getSessionMeta } from "@/server/utils/session-meta";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { authLimiter } from "@/server/utils/limiters";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    await enforceRateLimit(authLimiter, request.ip ?? "unknown");
    const body = await request.json();
    const parsed = loginSchema.parse(body);
    const sessionMeta = getSessionMeta();

    const result = await authService.login({
      email: parsed.email.toLowerCase(),
      password: parsed.password,
      totpCode: parsed.totpCode,
      ...sessionMeta
    });

    setAccessCookie(result.accessToken);
    setRefreshCookie(result.refreshToken);
    const csrfToken = issueCsrfCookie();

    return apiSuccess({ user: result.user, csrfToken }, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
