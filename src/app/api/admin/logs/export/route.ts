import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError } from "@/server/utils/api-response";
import { getRequestId } from "@/server/utils/request-context";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { adminMutationLimiter } from "@/server/utils/limiters";
import { adminService } from "@/server/services/admin-service";
import { adminLogsExportQuerySchema } from "@/server/validators/admin";

const buildExportFilename = (): string => {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    "_",
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0")
  ].join("");

  return `admin_logs_export_${stamp}.csv`;
};

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  try {
    await enforceRateLimit(adminMutationLimiter, request.ip ?? "unknown");
    const user = await requireAuth();
    assertRole(user.role, Role.ADMIN);

    const parsed = adminLogsExportQuerySchema.parse({
      action: request.nextUrl.searchParams.get("action") ?? undefined,
      targetType: request.nextUrl.searchParams.get("targetType") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    const result = await adminService.exportAdminLogsCsv(user.id, parsed);
    const headers = new Headers();
    headers.set("Content-Type", "text/csv; charset=utf-8");
    headers.set("Content-Disposition", `attachment; filename="${buildExportFilename()}"`);
    headers.set("x-request-id", requestId);
    headers.set("x-exported-count", String(result.exportedCount));

    return new Response(result.csv, {
      status: 200,
      headers
    });
  } catch (error: unknown) {
    return apiError(error, requestId);
  }
}
