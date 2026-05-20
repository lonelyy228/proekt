import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { adminService } from "@/server/services/admin-service";
import { adminWebhookQuickFiltersQuerySchema } from "@/server/validators/admin";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const parsed = adminWebhookQuickFiltersQuerySchema.parse({
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      eventType: request.nextUrl.searchParams.get("eventType") ?? undefined,
      processed: request.nextUrl.searchParams.get("processed") ?? undefined
    });

    const result = await adminService.listWebhookQuickFilters(parsed);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
