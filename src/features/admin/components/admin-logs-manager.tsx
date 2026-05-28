"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { useDebouncedValue } from "@/features/admin/hooks/use-debounced-value";
import { buildQueryString, countActiveFilters, toTrimmedOrUndefined } from "@/features/admin/lib/admin-table-utils";
import { AdminSavedViewsPanel } from "@/features/admin/components/admin-saved-views-panel";
import { buildExportFileName, downloadCsvFile } from "@/features/admin/lib/file-download";

type AdminLogItem = {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: unknown;
  createdAt: string;
  admin: {
    id: string;
    email: string;
  };
};

type PaginatedLogs = {
  items: AdminLogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type LogPresetFiltersPayload = {
  action?: string;
  targetType?: string;
  search?: string;
};

type AdminLogFilterPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  filters: LogPresetFiltersPayload;
};

const PAGE_SIZES = [10, 20, 50] as const;

const formatDate = (value: string): string =>
  new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

const formatDetailsPretty = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "{}";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
};

const formatDetailsInline = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "-";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
};

const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const AdminLogsManager = (): JSX.Element => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const didInitFromUrlRef = useRef<boolean>(false);
  const lastSerializedFiltersRef = useRef<string>("");
  const didAutoApplyDefaultPresetRef = useRef<boolean>(false);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [action, setAction] = useState<string>("");
  const [targetType, setTargetType] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied" | "error">("idle");
  const [exportState, setExportState] = useState<"idle" | "loading" | "error">("idle");
  const [presetName, setPresetName] = useState<string>("");
  const [presetAsDefault, setPresetAsDefault] = useState<boolean>(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (didInitFromUrlRef.current) {
      return;
    }

    const nextPageRaw = Number(searchParams.get("page") ?? "1");
    const nextPage = Number.isFinite(nextPageRaw) && nextPageRaw > 0 ? Math.floor(nextPageRaw) : 1;

    const nextPageSizeRaw = Number(searchParams.get("pageSize") ?? "20");
    const nextPageSize = PAGE_SIZES.includes(nextPageSizeRaw as (typeof PAGE_SIZES)[number]) ? nextPageSizeRaw : 20;

    setPage(nextPage);
    setPageSize(nextPageSize);
    setAction(searchParams.get("action") ?? "");
    setTargetType(searchParams.get("targetType") ?? "");
    setSearchInput(searchParams.get("search") ?? "");
    setSelectedPresetId(searchParams.get("view") ?? "");

    lastSerializedFiltersRef.current = searchParams.toString();
    didInitFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }
    setPage(1);
  }, [action, targetType, debouncedSearch, pageSize]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }

    const params = new URLSearchParams();
    if (page > 1) {
      params.set("page", String(page));
    }
    if (pageSize !== 20) {
      params.set("pageSize", String(pageSize));
    }
    if (action.trim()) {
      params.set("action", action.trim());
    }
    if (targetType.trim()) {
      params.set("targetType", targetType.trim());
    }
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (selectedPresetId) {
      params.set("view", selectedPresetId);
    }

    const serialized = params.toString();
    if (serialized === lastSerializedFiltersRef.current) {
      return;
    }

    lastSerializedFiltersRef.current = serialized;
    const href = serialized ? `${pathname}?${serialized}` : pathname;
    router.replace(href, { scroll: false });
  }, [action, debouncedSearch, page, pageSize, pathname, router, selectedPresetId, targetType]);

  const queryKey = useMemo(
    () => ["admin-logs", page, pageSize, action, targetType, debouncedSearch],
    [action, debouncedSearch, page, pageSize, targetType]
  );

  const logsQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<PaginatedLogs> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (action.trim()) {
        params.set("action", action.trim());
      }
      if (targetType.trim()) {
        params.set("targetType", targetType.trim());
      }
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      const response = await fetch(`/api/admin/logs?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить журналы администратора");
      }

      const payload = (await response.json()) as { success: boolean; data: PaginatedLogs };
      return payload.data;
    }
  });

  const presetsQuery = useQuery({
    queryKey: ["admin-log-filter-presets"],
    queryFn: async (): Promise<AdminLogFilterPreset[]> => {
      const response = await fetch("/api/admin/logs/presets", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить сохраненные представления логов");
      }
      const payload = (await response.json()) as { success: boolean; data: AdminLogFilterPreset[] };
      return payload.data;
    }
  });

  const selectedPreset = useMemo(
    () => presetsQuery.data?.find((item) => item.id === selectedPresetId),
    [presetsQuery.data, selectedPresetId]
  );

  useEffect(() => {
    if (!selectedPreset) {
      return;
    }

    setPresetName(selectedPreset.name);
    setPresetAsDefault(selectedPreset.isDefault);
  }, [selectedPreset]);

  const currentFiltersPayload = useMemo<LogPresetFiltersPayload>(
    () => ({
      action: action.trim() || undefined,
      targetType: targetType.trim() || undefined,
      search: debouncedSearch.trim() || undefined
    }),
    [action, debouncedSearch, targetType]
  );

  const applyPresetFilters = (filters: LogPresetFiltersPayload): void => {
    setAction(filters.action ?? "");
    setTargetType(filters.targetType ?? "");
    setSearchInput(filters.search ?? "");
    setPage(1);
  };

  useEffect(() => {
    if (!presetsQuery.data || !selectedPresetId) {
      return;
    }

    if (!presetsQuery.data.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId("");
    }
  }, [presetsQuery.data, selectedPresetId]);

  useEffect(() => {
    if (didAutoApplyDefaultPresetRef.current) {
      return;
    }
    if (!didInitFromUrlRef.current || !presetsQuery.data) {
      return;
    }
    if (selectedPresetId) {
      didAutoApplyDefaultPresetRef.current = true;
      return;
    }

    const hasManualFilters =
      page > 1 ||
      pageSize !== 20 ||
      action.trim().length > 0 ||
      targetType.trim().length > 0 ||
      debouncedSearch.trim().length > 0;
    if (hasManualFilters) {
      didAutoApplyDefaultPresetRef.current = true;
      return;
    }

    const defaultPreset = presetsQuery.data.find((preset) => preset.isDefault);
    if (!defaultPreset) {
      didAutoApplyDefaultPresetRef.current = true;
      return;
    }

    didAutoApplyDefaultPresetRef.current = true;
    setSelectedPresetId(defaultPreset.id);
    applyPresetFilters(defaultPreset.filters);
    setInfoMessage(`Применено представление по умолчанию: ${defaultPreset.name}`);
    setErrorMessage("");
  }, [action, debouncedSearch, page, pageSize, presetsQuery.data, selectedPresetId, targetType]);

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/logs/presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          name: presetName.trim(),
          filters: currentFiltersPayload,
          isDefault: presetAsDefault
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: AdminLogFilterPreset;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось сохранить представление");
      }

      return payload.data;
    },
    onSuccess: (preset) => {
      setSelectedPresetId(preset.id);
      setPresetName(preset.name);
      setPresetAsDefault(false);
      setInfoMessage("Представление логов сохранено");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-log-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при сохранении представления");
    }
  });

  const updatePresetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPresetId) {
        throw new Error("Выберите представление");
      }

      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/logs/presets/${encodeURIComponent(selectedPresetId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          name: presetName.trim() || undefined,
          filters: currentFiltersPayload,
          isDefault: presetAsDefault || undefined
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: AdminLogFilterPreset;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось обновить представление");
      }

      return payload.data;
    },
    onSuccess: (preset) => {
      setSelectedPresetId(preset.id);
      setPresetName(preset.name);
      setPresetAsDefault(false);
      setInfoMessage("Представление логов обновлено");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-log-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при обновлении представления");
    }
  });

  const deletePresetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPresetId) {
        throw new Error("Выберите представление");
      }

      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/logs/presets/${encodeURIComponent(selectedPresetId)}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось удалить представление"));
      }
    },
    onSuccess: () => {
      setSelectedPresetId("");
      setPresetName("");
      setPresetAsDefault(false);
      setInfoMessage("Представление логов удалено");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-log-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при удалении представления");
    }
  });

  const copyFiltersLink = async (): Promise<void> => {
    try {
      const href = `${window.location.origin}${pathname}${window.location.search}`;
      await navigator.clipboard.writeText(href);
      setCopyLinkState("copied");
      setInfoMessage("Ссылка с текущими фильтрами скопирована");
      setErrorMessage("");
      setTimeout(() => setCopyLinkState("idle"), 2000);
    } catch {
      setCopyLinkState("error");
      setInfoMessage("");
      setErrorMessage("Не удалось скопировать ссылку");
      setTimeout(() => setCopyLinkState("idle"), 2000);
    }
  };

  const copyDetails = async (details: unknown): Promise<void> => {
    try {
      await navigator.clipboard.writeText(formatDetailsPretty(details));
      setInfoMessage("JSON деталей скопирован");
      setErrorMessage("");
    } catch {
      setInfoMessage("");
      setErrorMessage("Не удалось скопировать JSON деталей");
    }
  };

  const exportLogsCsv = async (): Promise<void> => {
    try {
      setExportState("loading");
      const query = buildQueryString([
        ["action", toTrimmedOrUndefined(action)],
        ["targetType", toTrimmedOrUndefined(targetType)],
        ["search", toTrimmedOrUndefined(debouncedSearch)],
        ["limit", "1000"]
      ]);
      const response = await fetch(`/api/admin/logs/export${query ? `?${query}` : ""}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось выгрузить логи"));
      }

      const csv = await response.text();
      downloadCsvFile(buildExportFileName("admin-logs", "csv"), csv);
      setInfoMessage("CSV выгрузка логов готова");
      setErrorMessage("");
      setExportState("idle");
    } catch (error: unknown) {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка выгрузки логов");
      setExportState("error");
      setTimeout(() => setExportState("idle"), 2000);
    }
  };

  const activeFiltersCount = countActiveFilters([
    action.trim().length > 0,
    targetType.trim().length > 0,
    debouncedSearch.trim().length > 0,
    pageSize !== 20
  ]);

  const quickActions = useMemo(
    () =>
      Array.from(new Set((logsQuery.data?.items ?? []).map((item) => item.action)))
        .filter((value) => value.trim().length > 0)
        .slice(0, 8),
    [logsQuery.data?.items]
  );

  const quickTargetTypes = useMemo(
    () =>
      Array.from(new Set((logsQuery.data?.items ?? []).map((item) => item.targetType)))
        .filter((value) => value.trim().length > 0)
        .slice(0, 8),
    [logsQuery.data?.items]
  );

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Логи администратора</h2>

      <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-3 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Фильтр по action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Фильтр по targetType"
            value={targetType}
            onChange={(event) => setTargetType(event.target.value)}
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Поиск по targetId и email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={String(pageSize)}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} на страницу
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary"
            onClick={() => {
              void copyFiltersLink();
            }}
          >
            {copyLinkState === "copied"
              ? "Ссылка скопирована"
              : copyLinkState === "error"
                ? "Ошибка копирования"
                : "Скопировать ссылку"}
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => {
              setPage(1);
              setPageSize(20);
              setAction("");
              setTargetType("");
              setSearchInput("");
            }}
          >
            Сбросить фильтры
            {activeFiltersCount > 0 ? (
              <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{activeFiltersCount}</span>
            ) : null}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {quickActions.map((item) => (
            <button
              key={`action-${item}`}
              type="button"
              className="rounded-full border px-2 py-1 hover:border-primary hover:text-primary"
              onClick={() => {
                setAction(item);
                setPage(1);
              }}
            >
              action: {item}
            </button>
          ))}

          {quickTargetTypes.map((item) => (
            <button
              key={`target-${item}`}
              type="button"
              className="rounded-full border px-2 py-1 hover:border-primary hover:text-primary"
              onClick={() => {
                setTargetType(item);
                setPage(1);
              }}
            >
              target: {item}
            </button>
          ))}
        </div>

        <AdminSavedViewsPanel
          presets={presetsQuery.data ?? []}
          selectedPresetId={selectedPresetId}
          presetName={presetName}
          presetAsDefault={presetAsDefault}
          applyDisabled={!selectedPreset}
          createDisabled={!presetName.trim() || createPresetMutation.isPending}
          updateDisabled={!selectedPresetId || updatePresetMutation.isPending}
          deleteDisabled={!selectedPresetId || deletePresetMutation.isPending}
          isLoading={presetsQuery.isLoading}
          isError={presetsQuery.isError}
          onSelectedPresetIdChange={setSelectedPresetId}
          onPresetNameChange={setPresetName}
          onPresetAsDefaultChange={setPresetAsDefault}
          onApply={() => {
            if (!selectedPreset) {
              return;
            }
            applyPresetFilters(selectedPreset.filters);
            setInfoMessage(`Применено представление: ${selectedPreset.name}`);
            setErrorMessage("");
          }}
          onCreate={() => createPresetMutation.mutate()}
          onUpdate={() => updatePresetMutation.mutate()}
          onDelete={() => deletePresetMutation.mutate()}
          loadingText="Загружаем представления логов..."
          errorText="Не удалось загрузить представления логов."
        />
      </div>

      {infoMessage ? <p className="text-sm text-primary">{infoMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {logsQuery.isLoading ? <p className="text-sm text-muted-foreground">Загружаем логи...</p> : null}
      {logsQuery.isError ? <p className="text-sm text-destructive">Не удалось загрузить логи.</p> : null}

      {logsQuery.data ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3">Дата</th>
                  <th className="p-3">Администратор</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {logsQuery.data.items.map((log) => (
                  <tr key={log.id} className="border-t align-top">
                    <td className="p-3">{formatDate(log.createdAt)}</td>
                    <td className="p-3">{log.admin.email}</td>
                    <td className="p-3 font-medium">{log.action}</td>
                    <td className="p-3">
                      <p>{log.targetType}</p>
                      <p className="text-xs text-muted-foreground">{log.targetId}</p>
                    </td>
                    <td className="max-w-[560px] p-3 text-xs text-muted-foreground">
                      <p className="line-clamp-2 break-all">{formatDetailsInline(log.details)}</p>
                      <details className="mt-2 rounded border bg-card/60 p-2">
                        <summary className="cursor-pointer text-[11px] text-primary">Показать JSON</summary>
                        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all text-[11px]">
                          {formatDetailsPretty(log.details)}
                        </pre>
                      </details>
                      <button
                        type="button"
                        className="mt-2 rounded border px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
                        onClick={() => {
                          void copyDetails(log.details);
                        }}
                      >
                        Скопировать JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Страница {logsQuery.data.page} из {logsQuery.data.totalPages} ({logsQuery.data.total} записей)
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={logsQuery.data.page <= 1}
                type="button"
              >
                Назад
              </button>
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.min(logsQuery.data.totalPages, current + 1))}
                disabled={logsQuery.data.page >= logsQuery.data.totalPages}
                type="button"
              >
                Вперед
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
};
