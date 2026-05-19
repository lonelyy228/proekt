"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminRuntimeCheckStatus, AdminRuntimeSnapshot } from "@/features/admin/types/admin-operations";
import { AdminStateBlock } from "@/features/admin/components/admin-state-block";

type SettingsTab = "runtime" | "security" | "operations";

const tabs: Array<{ id: SettingsTab; label: string; description: string }> = [
  { id: "runtime", label: "Окружение", description: "Онлайн-проверки критичных компонентов." },
  { id: "security", label: "Безопасность", description: "Активные security-контроли системы." },
  { id: "operations", label: "Операции", description: "Регламент прод-эксплуатации и действий." }
];

const statusClass = (status: AdminRuntimeCheckStatus): string => {
  if (status === "HEALTHY") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "WARNING") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-destructive/40 bg-destructive/10 text-destructive";
};

const statusLabel = (status: AdminRuntimeCheckStatus): string => {
  if (status === "HEALTHY") {
    return "OK";
  }
  if (status === "WARNING") {
    return "Внимание";
  }
  return "Критично";
};

const resolveTab = (value: string | null): SettingsTab => {
  if (value === "security" || value === "operations") {
    return value;
  }
  return "runtime";
};

export const AdminSettingsCenter = (): JSX.Element => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastSerializedRef = useRef<string>("");

  const activeTab = resolveTab(searchParams.get("tab"));
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copyTabLinkState, setCopyTabLinkState] = useState<"idle" | "copied" | "error">("idle");
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const current = searchParams.toString();
    lastSerializedRef.current = current;
  }, [searchParams]);

  const runtimeQuery = useQuery({
    queryKey: ["admin-settings-runtime"],
    queryFn: async (): Promise<AdminRuntimeSnapshot> => {
      const response = await fetch("/api/admin/settings/runtime", { credentials: "include" });

      if (!response.ok) {
        throw new Error("Не удалось загрузить runtime-проверки");
      }

      const payload = (await response.json()) as { success: boolean; data: AdminRuntimeSnapshot };
      return payload.data;
    },
    refetchOnWindowFocus: false
  });

  const switchTab = (tab: SettingsTab): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "runtime") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }

    const serialized = params.toString();
    if (serialized === lastSerializedRef.current) {
      return;
    }

    setInfoMessage("");
    setErrorMessage("");
    lastSerializedRef.current = serialized;
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
  };

  const copyDiagnostics = async (): Promise<void> => {
    if (!runtimeQuery.data) {
      return;
    }

    try {
      const payload = {
        generatedAt: runtimeQuery.data.generatedAt,
        summary: runtimeQuery.data.summary,
        checks: runtimeQuery.data.checks
      };

      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyState("copied");
      setInfoMessage("Диагностика скопирована в буфер обмена");
      setErrorMessage("");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setInfoMessage("");
      setErrorMessage("Не удалось скопировать диагностику");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  const copyTabLink = async (): Promise<void> => {
    try {
      const href = `${window.location.origin}${pathname}${window.location.search}`;
      await navigator.clipboard.writeText(href);
      setCopyTabLinkState("copied");
      setInfoMessage("Ссылка на текущую вкладку скопирована");
      setErrorMessage("");
      setTimeout(() => setCopyTabLinkState("idle"), 2000);
    } catch {
      setCopyTabLinkState("error");
      setInfoMessage("");
      setErrorMessage("Не удалось скопировать ссылку на вкладку");
      setTimeout(() => setCopyTabLinkState("idle"), 2000);
    }
  };

  const checks = runtimeQuery.data?.checks ?? [];
  const sentrySampling = runtimeQuery.data?.sentrySampling;
  const securityControls = runtimeQuery.data?.securityControls ?? [];
  const operationsChecklist = runtimeQuery.data?.operationsChecklist ?? [];

  const summaryText = useMemo(() => {
    if (!runtimeQuery.data) {
      return "-";
    }

    const { healthy, warning, critical } = runtimeQuery.data.summary;
    return `OK: ${healthy} • Warning: ${warning} • Critical: ${critical}`;
  }, [runtimeQuery.data]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">Настройки</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={runtimeQuery.isFetching}
            onClick={() => {
              void runtimeQuery.refetch();
            }}
          >
            Обновить проверки
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={!runtimeQuery.data}
            onClick={() => {
              void copyDiagnostics();
            }}
          >
            {copyState === "copied" ? "Скопировано" : copyState === "error" ? "Ошибка копирования" : "Скопировать диагностику"}
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary"
            onClick={() => {
              void copyTabLink();
            }}
          >
            {copyTabLinkState === "copied"
              ? "Ссылка скопирована"
              : copyTabLinkState === "error"
                ? "Ошибка копирования"
                : "Скопировать ссылку вкладки"}
          </button>
        </div>
      </div>

      {infoMessage ? <p className="text-sm text-primary">{infoMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

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
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-2 py-1">Активная вкладка: {activeTab}</span>
          <span className="rounded-full border px-2 py-1">Checks: {checks.length}</span>
          <span className="rounded-full border px-2 py-1">Security controls: {securityControls.length}</span>
          <span className="rounded-full border px-2 py-1">Operations steps: {operationsChecklist.length}</span>
        </div>
      </div>

      {activeTab === "runtime" ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Runtime health</h3>
            <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{summaryText}</span>
          </div>
          {runtimeQuery.data ? (
            <p className="mt-2 text-xs text-muted-foreground">Последнее обновление: {new Date(runtimeQuery.data.generatedAt).toLocaleString("ru-RU")}</p>
          ) : null}

          {runtimeQuery.isLoading ? (
            <div className="mt-3">
              <AdminStateBlock
                title="Загружаем runtime-проверки"
                description="Собираем текущий health snapshot окружения."
              />
            </div>
          ) : null}
          {runtimeQuery.isError ? (
            <div className="mt-3">
              <AdminStateBlock
                title="Ошибка runtime-проверок"
                description="Не удалось получить runtime snapshot. Проверь доступность сервисов и повтори."
                actionLabel="Повторить"
                onAction={() => {
                  void runtimeQuery.refetch();
                }}
                tone="error"
              />
            </div>
          ) : null}

          {checks.length > 0 ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {checks.map((check) => (
                <article key={check.key} className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{check.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{check.description}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(check.status)}`}>
                      {statusLabel(check.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{check.message}</p>
                </article>
              ))}
            </div>
          ) : null}

          {sentrySampling ? (
            <article className="mt-3 rounded-md border bg-background p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">Sentry sampling policy</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Effective rates для server-side мониторинга и noise control.
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    sentrySampling.configured
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {sentrySampling.configured ? "Sentry ON" : "Sentry OFF"}
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                <p className="rounded-md border px-2 py-1">Error: {sentrySampling.errorRate}</p>
                <p className="rounded-md border px-2 py-1">Warning: {sentrySampling.warningRate}</p>
                <p className="rounded-md border px-2 py-1">Info: {sentrySampling.infoRate}</p>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {activeTab === "security" ? (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Security controls</h3>
          {securityControls.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {securityControls.map((item) => (
                <li key={item} className="rounded-md border bg-card/60 p-2">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Контроли безопасности будут доступны после загрузки runtime-снимка.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Секреты и ключи не редактируются через UI. Управление только через Vercel/провайдеров и утвержденный процесс ротации.
          </p>
        </div>
      ) : null}

      {activeTab === "operations" ? (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operational checklist</h3>
          {operationsChecklist.length > 0 ? (
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              {operationsChecklist.map((item, index) => (
                <li key={item} className="rounded-md border bg-card/60 p-2">
                  {index + 1}. {item}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Чеклист операций появится после загрузки runtime-снимка.</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="rounded-md border px-3 py-1 text-xs hover:border-primary hover:text-primary" href="/admin/backups?tab=drills">
              Открыть recovery drills
            </Link>
            <Link className="rounded-md border px-3 py-1 text-xs hover:border-primary hover:text-primary" href="/admin/logs">
              Открыть admin logs
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
};
