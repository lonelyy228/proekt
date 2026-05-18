import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { authService } from "@/server/services/auth-service";
import { totpVerifySchema } from "@/server/validators/auth";
import { assertValidCsrf } from "@/server/utils/csrf";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    assertValidCsrf();
    const user = await requireAuth();
    const body = await request.json();
    const { code } = totpVerifySchema.parse(body);

    const result = await authService.verify2faCode(user.id, code);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
