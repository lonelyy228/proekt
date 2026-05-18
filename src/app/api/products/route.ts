import { NextRequest } from "next/server";
import { productQuerySchema } from "@/server/validators/product";
import { parsePagination } from "@/server/utils/pagination";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { productService } from "@/server/services/product-service";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const pagination = parsePagination(request.nextUrl.searchParams);
    const query = productQuerySchema.parse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      brand: request.nextUrl.searchParams.get("brand") ?? undefined,
      minPrice: request.nextUrl.searchParams.get("minPrice") ?? undefined,
      maxPrice: request.nextUrl.searchParams.get("maxPrice") ?? undefined,
      minPriceCents: request.nextUrl.searchParams.get("minPriceCents") ?? undefined,
      maxPriceCents: request.nextUrl.searchParams.get("maxPriceCents") ?? undefined,
      sortBy: request.nextUrl.searchParams.get("sortBy") ?? undefined
    });

    const minPriceCents =
      query.minPrice !== undefined ? Math.round(query.minPrice * 100) : query.minPriceCents;
    const maxPriceCents =
      query.maxPrice !== undefined ? Math.round(query.maxPrice * 100) : query.maxPriceCents;

    const catalog = await productService.listCatalog({
      search: query.search,
      category: query.category,
      brand: query.brand,
      sortBy: query.sortBy,
      minPriceCents,
      maxPriceCents,
      ...pagination
    });

    return apiSuccess(catalog, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
