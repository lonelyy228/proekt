import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { adminSettingsService } from "@/server/services/admin-settings-service";

export async function GET(): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const snapshot = await adminSettingsService.getRuntimeSnapshot();
    return apiSuccess(snapshot, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
