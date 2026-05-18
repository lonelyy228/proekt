import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { wishlistService } from "@/server/services/wishlist-service";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    const wishlist = await wishlistService.list(user.id);
    return apiSuccess(wishlist, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
