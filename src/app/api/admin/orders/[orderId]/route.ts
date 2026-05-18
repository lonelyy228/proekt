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
import { adminOrderIdParamsSchema, adminOrderStatusUpdateSchema } from "@/server/validators/admin";

export async function GET(
  _request: NextRequest,
  context: { params: { orderId: string } }
): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);
    const params = adminOrderIdParamsSchema.parse(context.params);
    const result = await adminService.getOrderDetails(params.orderId);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { orderId: string } }
): Promise<Response> {
  const requestId = getRequestId();

  try {
    await enforceRateLimit(adminMutationLimiter, request.ip ?? "unknown");
    assertValidCsrf();
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const params = adminOrderIdParamsSchema.parse(context.params);
    const body = await request.json();
    const parsed = adminOrderStatusUpdateSchema.parse(body);
    const result = await adminService.updateOrderStatus(user.id, params.orderId, parsed.status);

    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
