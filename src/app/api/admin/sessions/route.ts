import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { adminService } from "@/server/services/admin-service";
import { adminSessionsQuerySchema, adminSessionRevokeSchema } from "@/server/validators/admin";
import { assertValidCsrf } from "@/server/utils/csrf";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { adminMutationLimiter } from "@/server/utils/limiters";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const parsed = adminSessionsQuerySchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      userId: request.nextUrl.searchParams.get("userId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined
    });

    const result = await adminService.listSessions(parsed);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    await enforceRateLimit(adminMutationLimiter, request.ip ?? "unknown");
    assertValidCsrf();
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const parsed = adminSessionRevokeSchema.parse({
      sessionId: request.nextUrl.searchParams.get("sessionId")
    });

    const result = await adminService.revokeSession(user.id, parsed.sessionId);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
