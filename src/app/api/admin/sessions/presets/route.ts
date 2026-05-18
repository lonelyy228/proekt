import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { assertValidCsrf } from "@/server/utils/csrf";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { adminMutationLimiter } from "@/server/utils/limiters";
import { adminSessionPresetsService } from "@/server/services/admin-session-presets-service";
import { adminSessionFilterPresetCreateSchema } from "@/server/validators/admin";

export async function GET(): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);
    const result = await adminSessionPresetsService.list(user.id);
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
    const parsed = adminSessionFilterPresetCreateSchema.parse(body);
    const result = await adminSessionPresetsService.create(user.id, parsed);
    return apiSuccess(result, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
