import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { assertValidCsrf } from "@/server/utils/csrf";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { adminMutationLimiter } from "@/server/utils/limiters";
import { adminService } from "@/server/services/admin-service";
import { adminSessionBulkRevokeSchema } from "@/server/validators/admin";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    await enforceRateLimit(adminMutationLimiter, request.ip ?? "unknown");
    assertValidCsrf();
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const body = await request.json();
    const parsed = adminSessionBulkRevokeSchema.parse(body);
    const shouldExcludeCurrentSession = parsed.userId ? parsed.userId === user.id : true;
    const result = await adminService.revokeSessionsBulk(user.id, {
      userId: parsed.userId,
      search: parsed.search,
      status: parsed.status,
      limit: parsed.limit,
      dryRun: parsed.dryRun,
      excludeSessionId: shouldExcludeCurrentSession ? user.sessionId : undefined
    });
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
