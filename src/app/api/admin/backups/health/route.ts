import { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { adminBackupsService } from "@/server/services/admin-backups-service";

export async function GET(): Promise<Response> {
  const requestId = getRequestId();

  try {
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const snapshot = await adminBackupsService.getSnapshot();
    return apiSuccess(snapshot, requestId);
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
