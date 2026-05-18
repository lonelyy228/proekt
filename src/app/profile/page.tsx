import Link from "next/link";
import { requireAuth } from "@/server/utils/require-auth";
import { authService } from "@/server/services/auth-service";
import { ProfileOrdersTable } from "@/features/orders/components/profile-orders-table";

export const dynamic = "force-dynamic";

export default async function ProfilePage(): Promise<JSX.Element> {
  const user = await requireAuth();
  const me = await authService.me(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Профиль</h1>
      <p className="text-muted-foreground">Вы вошли как {user.email}</p>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Безопасность</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          2FA: {me.twoFactorEnabled ? "включена" : "выключена"}. Управляйте двухфакторной аутентификацией и активными
          сессиями на отдельной странице.
        </p>
        <Link href="/profile/security" className="mt-3 inline-flex rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary">
          Открыть настройки безопасности
        </Link>
      </section>

      <ProfileOrdersTable />
    </div>
  );
}
