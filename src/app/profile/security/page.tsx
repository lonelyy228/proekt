import Link from "next/link";
import { requireAuth } from "@/server/utils/require-auth";
import { authService } from "@/server/services/auth-service";
import { ProfileSecurityPanel } from "@/features/auth/components/profile-security-panel";

export const dynamic = "force-dynamic";

export default async function ProfileSecurityPage(): Promise<JSX.Element> {
  const user = await requireAuth();
  const me = await authService.me(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Security</p>
        <h1 className="mt-2 text-3xl font-semibold">Безопасность аккаунта</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Управляйте 2FA, проверяйте активные сессии и завершайте лишние входы.
        </p>
      </div>

      <ProfileSecurityPanel twoFactorEnabled={me.twoFactorEnabled} />

      <Link href="/profile" className="inline-flex rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary">
        Вернуться в профиль
      </Link>
    </div>
  );
}
