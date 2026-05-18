import { NextRequest } from "next/server";
import { registerSchema } from "@/server/validators/auth";
import { authService } from "@/server/services/auth-service";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { sanitizeText } from "@/server/utils/sanitize";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { authLimiter } from "@/server/utils/limiters";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    await enforceRateLimit(authLimiter, request.ip ?? "unknown");
    const body = await request.json();
    const parsed = registerSchema.parse(body);
    const user = await authService.register(sanitizeText(parsed.email).toLowerCase(), parsed.password);
    return apiSuccess({ user }, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
