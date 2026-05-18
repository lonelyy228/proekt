import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { orderService } from "@/server/services/order-service";
import { profileOrdersQuerySchema } from "@/server/validators/profile";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    const parsed = profileOrdersQuerySchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined
    });

    const orders = await orderService.listForUserPaginated({
      userId: user.id,
      page: parsed.page,
      pageSize: parsed.pageSize,
      status: parsed.status
    });

    return apiSuccess(orders, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
