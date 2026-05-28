"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBackupsSnapshot } from "@/features/admin/types/admin-operations";
import { buildSnapshotFileName, downloadJsonFile } from "@/features/admin/lib/file-download";

type BackupsTab = "policy" | "runbook" | "drills";

const tabs: Array<{ id: BackupsTab; label: string; description: string }> = [
  { id: "policy", label: "Политика", description: "Требования к хранению и ретеншену." },
  { id: "runbook", label: "Протокол", description: "Пошаговый план восстановления." },
  { id: "drills", label: "Учения", description: "Регулярные recovery-проверки и владельцы." }
];

const statusChipClass = (isGood: boolean): string =>
  isGood
    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-destructive/40 bg-destructive/10 text-destructive";

const resolveTab = (value: string | null): BackupsTab => {
  if (value === "runbook" || value === "drills") {
    return value;
  }
  return "policy";
};

export const AdminBackupsCenter = (): JSX.Element => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastSerializedRef = useRef<string>("");

  const activeTab = resolveTab(searchParams.get("tab"));

  useEffect(() => {
    lastSerializedRef.current = searchParams.toString();
  }, [searchParams]);

  const backupsQuery = useQuery({
    queryKey: ["admin-backups-health"],
    queryFn: async (): Promise<AdminBackupsSnapshot> => {
      const response = await fetch("/api/admin/backups/health", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить данные по резервированию");
      }

      const payload = (await response.json()) as { success: boolean; data: AdminBackupsSnapshot };
      return payload.data;
    },
    refetchOnWindowFocus: false
  });

  const switchTab = (tab: BackupsTab): void => {
    const params = new URLSearchParams(searchParams.toString());

    if (tab === "policy") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }

    const serialized = params.toString();
    if (serialized === lastSerializedRef.current) {
      return;
    }

    lastSerializedRef.current = serialized;
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
  };

  const copyRunbook = async (): Promise<void> => {
    if (!backupsQuery.data) {
      return;
    }

    const text = backupsQuery.data.restoreRunbook.map((step, index) => `${index + 1}. ${step}`).join("\n");
    await navigator.clipboard.writeText(text);
  };

  const copyPolicy = async (): Promise<void> => {
    if (!backupsQuery.data) {
      return;
    }

    const text = backupsQuery.data.policyChecklist.map((item, index) => `${index + 1}. ${item}`).join("\n");
    await navigator.clipboard.writeText(text);
  };

  const exportBackupsSnapshot = (): void => {
    if (!backupsQuery.data) {
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      sourceUrl: `${window.location.origin}${pathname}${window.location.search}`,
      ...backupsQuery.data
    };

    downloadJsonFile(buildSnapshotFileName("admin-backups-snapshot", "json"), payload);
  };

  const providerSummary = useMemo(() => {
    if (!backupsQuery.data) {
      return "-";
    }

    return `${backupsQuery.data.provider.database} • ${backupsQuery.data.provider.uploadStorage}`;
  }, [backupsQuery.data]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">Резервные копии</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={backupsQuery.isFetching}
            onClick={() => {
              void backupsQuery.refetch();
            }}
          >
            Обновить статус
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={!backupsQuery.data}
            onClick={() => {
              void copyPolicy();
            }}
          >
            Скопировать политику
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={!backupsQuery.data}
            onClick={() => {
              void copyRunbook();
            }}
          >
            Скопировать runbook
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={!backupsQuery.data}
            onClick={exportBackupsSnapshot}
          >
            Экспорт JSON
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="grid gap-2 md:grid-cols-3">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                className={`rounded-md border p-3 text-left text-sm transition-colors ${
                  isActive ? "border-primary bg-primary/5" : "hover:border-primary/60"
                }`}
                onClick={() => switchTab(tab.id)}
              >
                <p className="font-semibold">{tab.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tab.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Health snapshot</h3>
          <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{providerSummary}</span>
        </div>

        {backupsQuery.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Загружаем snapshot...</p> : null}
        {backupsQuery.isError ? <p className="mt-3 text-sm text-destructive">Не удалось загрузить snapshot резервирования.</p> : null}

        {backupsQuery.data ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full border px-2 py-1 ${statusChipClass(backupsQuery.data.status.databaseReachable)}`}>
              DB: {backupsQuery.data.status.databaseReachable ? "доступна" : "недоступна"}
            </span>
            <span className={`rounded-full border px-2 py-1 ${statusChipClass(backupsQuery.data.status.uploadConfigured)}`}>
              Upload: {backupsQuery.data.status.uploadConfigured ? "настроен" : "не настроен"}
            </span>
            <span className={`rounded-full border px-2 py-1 ${statusChipClass(backupsQuery.data.status.pitrLikelySupported)}`}>
              PITR: {backupsQuery.data.status.pitrLikelySupported ? "вероятно поддерживается" : "требует проверки"}
            </span>
          </div>
        ) : null}
      </div>

      {activeTab === "policy" && backupsQuery.data ? (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Стратегия резервирования</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {backupsQuery.data.policyChecklist.map((item) => (
              <li key={item} className="rounded-md border bg-card/60 p-2">
                {item}
              </li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {backupsQuery.data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {activeTab === "runbook" && backupsQuery.data ? (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Runbook восстановления</h3>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            {backupsQuery.data.restoreRunbook.map((item, index) => (
              <li key={item} className="rounded-md border bg-card/60 p-2">
                {index + 1}. {item}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {activeTab === "drills" && backupsQuery.data ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recovery drills</h3>
            <Link className="rounded-md border px-3 py-1 text-xs hover:border-primary hover:text-primary" href="/admin/logs?targetType=backup">
              Открыть backup-логи
            </Link>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3">Сценарий</th>
                  <th className="p-3">Периодичность</th>
                  <th className="p-3">Цель</th>
                  <th className="p-3">SLO</th>
                  <th className="p-3">Владелец</th>
                </tr>
              </thead>
              <tbody>
                {backupsQuery.data.drills.map((row) => (
                  <tr key={row.name} className="border-t">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3">{row.cadence}</td>
                    <td className="p-3 text-muted-foreground">{row.objective}</td>
                    <td className="p-3">{row.target}</td>
                    <td className="p-3">{row.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
};
