import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { Role } from "@prisma/client";
import { adminProductListQuerySchema, productCreateSchema } from "@/server/validators/product";
import { adminService } from "@/server/services/admin-service";
import { assertValidCsrf } from "@/server/utils/csrf";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { adminMutationLimiter } from "@/server/utils/limiters";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const parsed = adminProductListQuerySchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      brand: request.nextUrl.searchParams.get("brand") ?? undefined,
      categoryId: request.nextUrl.searchParams.get("categoryId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      sortBy: request.nextUrl.searchParams.get("sortBy") ?? undefined
    });

    const result = await adminService.listProducts(parsed);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    await enforceRateLimit(adminMutationLimiter, request.ip ?? "unknown");
    assertValidCsrf();
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const body = await request.json();
    const parsed = productCreateSchema.parse(body);
    const product = await adminService.createProduct(user.id, parsed);

    return apiSuccess(product, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
