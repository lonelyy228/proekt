import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { adminService } from "@/server/services/admin-service";
import { adminLogsQuickFiltersQuerySchema } from "@/server/validators/admin";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const parsed = adminLogsQuickFiltersQuerySchema.parse({
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      action: request.nextUrl.searchParams.get("action") ?? undefined,
      targetType: request.nextUrl.searchParams.get("targetType") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined
    });

    const result = await adminService.listAdminLogsQuickFilters(parsed);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
