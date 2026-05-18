import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { wishlistService } from "@/server/services/wishlist-service";
import { wishlistToggleSchema } from "@/server/validators/wishlist";
import { assertValidCsrf } from "@/server/utils/csrf";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    assertValidCsrf();
    const user = await requireAuth();
    const body = await request.json();
    const parsed = wishlistToggleSchema.parse(body);
    const result = await wishlistService.toggle(user.id, parsed.productId, parsed.variantId);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
