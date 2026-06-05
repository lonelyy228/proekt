import { NextRequest } from "next/server";
import { registerSchema } from "@/server/validators/auth";
import { authService } from "@/server/services/auth-service";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { sanitizeText } from "@/server/utils/sanitize";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { authLimiter } from "@/server/utils/limiters";
import { getSessionMeta } from "@/server/utils/session-meta";
import { setAccessCookie, setRefreshCookie } from "@/server/utils/cookies";
import { issueCsrfCookie } from "@/server/utils/csrf";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    await enforceRateLimit(authLimiter, request.ip ?? "unknown");
    const body = await request.json();
    const parsed = registerSchema.parse(body);
    const email = sanitizeText(parsed.email).toLowerCase();
    const sessionMeta = getSessionMeta();

    await authService.register(email, parsed.password);
    const result = await authService.login({
      email,
      password: parsed.password,
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
