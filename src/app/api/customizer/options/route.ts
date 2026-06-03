import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { productService } from "@/server/services/product-service";

export async function GET(): Promise<Response> {
  const requestId = getRequestId();

  try {
    const options = await productService.listCustomizerBaseProducts();
    return apiSuccess(options, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
