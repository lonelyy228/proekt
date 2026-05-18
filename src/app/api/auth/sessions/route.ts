import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { authService } from "@/server/services/auth-service";
import { assertValidCsrf } from "@/server/utils/csrf";
import { sessionRevokeSchema } from "@/server/validators/profile";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    const sessions = await authService.listSessions(user.id, user.sessionId);
    return apiSuccess(sessions, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    assertValidCsrf();
    const user = await requireAuth();
    const parsed = sessionRevokeSchema.parse({
      sessionId: request.nextUrl.searchParams.get("sessionId")
    });
    const result = await authService.revokeSession(user.id, user.sessionId, parsed.sessionId);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
