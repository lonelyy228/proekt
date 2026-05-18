import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { authService } from "@/server/services/auth-service";
import { assertValidCsrf } from "@/server/utils/csrf";

export async function POST(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    assertValidCsrf();
    const user = await requireAuth();
    const setup = await authService.setup2fa(user.id, user.email);
    return apiSuccess(setup, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
