import { AdminSessionsTable } from "@/features/admin/components/admin-sessions-table";

export default function AdminSessionsPage(): JSX.Element {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Управление сессиями</h2>
      <AdminSessionsTable />
    </section>
  );
}
