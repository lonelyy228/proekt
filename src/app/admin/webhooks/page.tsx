import { AdminWebhookMonitor } from "@/features/admin/components/admin-webhook-monitor";

export default function AdminWebhooksPage(): JSX.Element {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Мониторинг Stripe Webhooks</h2>
      <AdminWebhookMonitor />
    </section>
  );
}
