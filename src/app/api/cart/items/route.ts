import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { cartService } from "@/server/services/cart-service";
import { cartItemSchema } from "@/server/validators/cart";
import { assertValidCsrf } from "@/server/utils/csrf";
import { AppError } from "@/server/utils/errors";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    assertValidCsrf();
    const user = await requireAuth();
    const body = await request.json();
    const parsed = cartItemSchema.parse(body);
    const cart = await cartService.upsertItem(user.id, parsed);
    return apiSuccess(cart, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    assertValidCsrf();
    const user = await requireAuth();
    const itemId = request.nextUrl.searchParams.get("itemId");
    if (!itemId) {
      throw new AppError("VALIDATION_ERROR", "itemId is required");
    }
    const cart = await cartService.removeItem(user.id, itemId);
    return apiSuccess(cart, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
