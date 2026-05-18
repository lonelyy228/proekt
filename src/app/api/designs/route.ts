import { NextRequest } from "next/server";
import { designService } from "@/server/services/design-service";
import { designSchema } from "@/server/validators/design";
import { requireAuth } from "@/server/utils/require-auth";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { assertValidCsrf } from "@/server/utils/csrf";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const user = await requireAuth();
    const items = await designService.listByUser(user.id);
    return apiSuccess(items, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    assertValidCsrf();
    const user = await requireAuth();
    const body = await request.json();
    const parsed = designSchema.parse(body);
    const design = await designService.create(user.id, parsed);
    return apiSuccess(design, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
