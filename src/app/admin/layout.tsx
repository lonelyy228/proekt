import { ReactNode } from "react";
import { requireAuth } from "@/server/utils/require-auth";
import { assertRole } from "@/server/utils/rbac";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }): Promise<JSX.Element> {
  const user = await requireAuth();
  assertRole(user.role, Role.ADMIN);

  return <div className="space-y-8">{children}</div>;
}
