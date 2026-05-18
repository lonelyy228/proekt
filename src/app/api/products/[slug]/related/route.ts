import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { productService } from "@/server/services/product-service";

export async function GET(
  _request: NextRequest,
  context: { params: { slug: string } }
): Promise<Response> {
  const requestId = getRequestId();
  try {
    const related = await productService.getRelatedProducts(context.params.slug);
    return apiSuccess(related, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
