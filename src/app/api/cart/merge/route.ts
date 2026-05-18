import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { cartService } from "@/server/services/cart-service";
import { cartMergeSchema } from "@/server/validators/cart";
import { assertValidCsrf } from "@/server/utils/csrf";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    assertValidCsrf();
    const user = await requireAuth();
    const body = await request.json();
    const parsed = cartMergeSchema.parse(body);
    const cart = await cartService.mergeGuestCart(user.id, parsed.guestItems);
    return apiSuccess(cart, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
