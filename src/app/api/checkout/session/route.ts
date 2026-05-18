import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { checkoutSessionSchema } from "@/server/validators/checkout";
import { checkoutService } from "@/server/services/checkout-service";
import { assertValidCsrf } from "@/server/utils/csrf";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { checkoutLimiter } from "@/server/utils/limiters";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    await enforceRateLimit(checkoutLimiter, request.ip ?? "unknown");
    assertValidCsrf();
    const user = await requireAuth();
    const body = await request.json();
    const parsed = checkoutSessionSchema.parse(body);

    const session = await checkoutService.createCheckoutSession(user.id, parsed);
    return apiSuccess(session, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
