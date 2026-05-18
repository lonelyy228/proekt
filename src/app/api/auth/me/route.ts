import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { authService } from "@/server/services/auth-service";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const user = await requireAuth();
    const me = await authService.me(user.id);
    return apiSuccess(me, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
