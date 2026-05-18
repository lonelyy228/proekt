import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { adminService } from "@/server/services/admin-service";
import { adminAnalyticsQuerySchema } from "@/server/validators/admin";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const parsed = adminAnalyticsQuerySchema.parse({
      periodDays: request.nextUrl.searchParams.get("periodDays") ?? undefined
    });

    const result = await adminService.analytics(parsed.periodDays);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
