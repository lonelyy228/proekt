import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { assertValidCsrf } from "@/server/utils/csrf";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { adminMutationLimiter } from "@/server/utils/limiters";
import { contentService } from "@/server/services/content-service";
import { contentPostIdParamsSchema, contentUpdateSchema } from "@/server/validators/content";

export async function PATCH(
  request: NextRequest,
  context: { params: { postId: string } }
): Promise<Response> {
  const requestId = getRequestId();

  try {
    await enforceRateLimit(adminMutationLimiter, request.ip ?? "unknown");
    assertValidCsrf();
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const params = contentPostIdParamsSchema.parse(context.params);
    const body = await request.json();
    const parsed = contentUpdateSchema.parse(body);
    const post = await contentService.update(user.id, params.postId, parsed);

    return apiSuccess(post, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
