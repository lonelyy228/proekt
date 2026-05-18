import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { adminUsersQuerySchema } from "@/server/validators/admin";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { adminService } from "@/server/services/admin-service";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const parsed = adminUsersQuerySchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      role: request.nextUrl.searchParams.get("role") ?? undefined,
      isBlocked: request.nextUrl.searchParams.get("isBlocked") ?? undefined
    });

    const result = await adminService.listUsers(parsed);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
