import Link from "next/link";
import { AdminDashboardOverview } from "@/features/admin/components/admin-dashboard-overview";
import { AdminDashboardAnalytics } from "@/features/admin/components/admin-dashboard-analytics";

export const dynamic = "force-dynamic";

const navItems: Array<{ href: string; title: string; description: string }> = [
  {
    href: "/admin/users",
    title: "Пользователи",
    description: "Роли, блокировки, массовые операции и пресеты фильтров."
  },
  {
    href: "/admin/products",
    title: "Товары",
    description: "Каталог, статусы, пресеты, bulk-изменения и редактирование."
  },
  {
    href: "/admin/orders",
    title: "Заказы",
    description: "Операционный список, экспорт CSV, transitions статусов и bulk."
  },
  {
    href: "/admin/content",
    title: "Контент",
    description: "Публикации, статусы и сохраненные фильтры."
  },
  {
    href: "/admin/sessions",
    title: "Сессии",
    description: "Контроль активных сессий, фильтры и массовый отзыв доступа."
  },
  {
    href: "/admin/webhooks",
    title: "Webhooks",
    description: "Мониторинг Stripe-событий, replay и пресеты фильтров."
  },
  {
    href: "/admin/logs",
    title: "Логи",
    description: "Журнал действий администраторов с поиском и фильтрами."
  },
  {
    href: "/admin/settings",
    title: "Настройки",
    description: "Runtime и security параметры, эксплуатационные проверки."
  },
  {
    href: "/admin/backups",
    title: "Резервные копии",
    description: "Runbook восстановления, политики и drills."
  }
];

export default function AdminPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Панель администратора</h1>
        <p className="text-sm text-muted-foreground">
          Единый центр управления каталогом, заказами, безопасностью и операционными процессами.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border bg-card p-4 transition-colors hover:border-primary"
          >
            <p className="text-base font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </section>

      <AdminDashboardOverview />
      <AdminDashboardAnalytics />
    </div>
  );
}
