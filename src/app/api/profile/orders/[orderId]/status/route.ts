import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { orderService } from "@/server/services/order-service";

export async function GET(
  _request: NextRequest,
  context: { params: { orderId: string } }
): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    const status = await orderService.getUserOrderStatus(user.id, context.params.orderId);
    return apiSuccess(status, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
