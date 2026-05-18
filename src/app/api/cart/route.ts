import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { cartService } from "@/server/services/cart-service";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    const cart = await cartService.getCart(user.id);
    return apiSuccess(cart, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
