"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { useDebouncedValue } from "@/features/admin/hooks/use-debounced-value";
import { countActiveFilters } from "@/features/admin/lib/admin-table-utils";
import { AdminSavedViewsPanel } from "@/features/admin/components/admin-saved-views-panel";

type SessionStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

type SessionItem = {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
  };
  status: SessionStatus;
  deviceType: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

type PaginatedSessions = {
  items: SessionItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type BulkSessionResponse = {
  dryRun: boolean;
  matchedCount: number;
  revokedCount: number;
};

type SessionPresetFiltersPayload = {
  search?: string;
  status?: SessionStatus;
};

type AdminSessionFilterPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  filters: SessionPresetFiltersPayload;
};

const formatDate = (value: string): string =>
  new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

const getStatusLabel = (status: SessionStatus): string => {
  switch (status) {
    case "ACTIVE":
      return "Активна";
    case "REVOKED":
      return "Завершена";
    case "EXPIRED":
      return "Истекла";
    default:
      return status;
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

export const AdminSessionsTable = (): JSX.Element => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitFromUrlRef = useRef<boolean>(false);
  const lastSerializedFiltersRef = useRef<string>("");

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [status, setStatus] = useState<"" | SessionStatus>("ACTIVE");
  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [bulkLimit, setBulkLimit] = useState<number>(50);
  const [bulkDryRun, setBulkDryRun] = useState<boolean>(true);
  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied" | "error">("idle");
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
    const nextPageSize = nextPageSizeRaw === 10 || nextPageSizeRaw === 20 || nextPageSizeRaw === 50 ? nextPageSizeRaw : 20;
    const nextStatusRaw = searchParams.get("status");
    const nextStatus =
      nextStatusRaw === "ACTIVE" || nextStatusRaw === "REVOKED" || nextStatusRaw === "EXPIRED"
        ? nextStatusRaw
        : "ACTIVE";
    const nextSearch = searchParams.get("search") ?? "";

    setPage(nextPage);
    setPageSize(nextPageSize);
    setStatus(nextStatus);
    setSearchInput(nextSearch);

    lastSerializedFiltersRef.current = searchParams.toString();
    didInitFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }
    setPage(1);
  }, [debouncedSearch, status, pageSize]);

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
    if (status !== "ACTIVE") {
      params.set("status", status);
    }
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }

    const serialized = params.toString();
    if (serialized === lastSerializedFiltersRef.current) {
      return;
    }

    lastSerializedFiltersRef.current = serialized;
    const href = serialized ? `${pathname}?${serialized}` : pathname;
    router.replace(href, { scroll: false });
  }, [debouncedSearch, page, pageSize, pathname, router, status]);

  const queryKey = useMemo(
    () => ["admin-sessions", page, pageSize, status, debouncedSearch],
    [debouncedSearch, page, pageSize, status]
  );

  const sessionsQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<PaginatedSessions> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (status) {
        params.set("status", status);
      }
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      const response = await fetch(`/api/admin/sessions?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить сессии");
      }

      const payload = (await response.json()) as { success: boolean; data: PaginatedSessions };
      return payload.data;
    }
  });

  const presetsQuery = useQuery({
    queryKey: ["admin-session-filter-presets"],
    queryFn: async (): Promise<AdminSessionFilterPreset[]> => {
      const response = await fetch("/api/admin/sessions/presets", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить пресеты сессий");
      }

      const payload = (await response.json()) as { success: boolean; data: AdminSessionFilterPreset[] };
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

  const currentFiltersPayload = useMemo<SessionPresetFiltersPayload>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: status && status !== "ACTIVE" ? status : undefined
    }),
    [debouncedSearch, status]
  );

  const applyPresetFilters = (filters: SessionPresetFiltersPayload): void => {
    setSearchInput(filters.search ?? "");
    setStatus(filters.status ?? "ACTIVE");
    setPage(1);
  };

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/sessions?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось завершить сессию"));
      }
    },
    onSuccess: () => {
      setInfoMessage("Сессия завершена");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка завершения сессии");
    }
  });

  const bulkRevokeMutation = useMutation({
    mutationFn: async (input: {
      userId?: string;
      search?: string;
      status: SessionStatus;
      limit: number;
      dryRun: boolean;
    }): Promise<BulkSessionResponse> => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/sessions/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify(input)
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: BulkSessionResponse;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось выполнить массовое завершение сессий");
      }

      return payload.data;
    },
    onSuccess: (result) => {
      if (result.dryRun) {
        setInfoMessage(`Проверка: найдено ${result.matchedCount} сессий, изменений не внесено`);
      } else {
        setInfoMessage(`Завершено сессий: ${result.revokedCount} (совпадений: ${result.matchedCount})`);
      }
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка массового завершения сессий");
    }
  });

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/sessions/presets", {
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
        data?: AdminSessionFilterPreset;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось сохранить пресет");
      }
      return payload.data;
    },
    onSuccess: (preset) => {
      setSelectedPresetId(preset.id);
      setPresetName(preset.name);
      setPresetAsDefault(false);
      setInfoMessage("Пресет сессий сохранен");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-session-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка сохранения пресета");
    }
  });

  const updatePresetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPresetId) {
        throw new Error("Выберите пресет");
      }

      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/sessions/presets/${encodeURIComponent(selectedPresetId)}`, {
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
        data?: AdminSessionFilterPreset;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось обновить пресет");
      }
      return payload.data;
    },
    onSuccess: (preset) => {
      setSelectedPresetId(preset.id);
      setPresetName(preset.name);
      setPresetAsDefault(false);
      setInfoMessage("Пресет сессий обновлен");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-session-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления пресета");
    }
  });

  const deletePresetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPresetId) {
        throw new Error("Выберите пресет");
      }

      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/sessions/presets/${encodeURIComponent(selectedPresetId)}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось удалить пресет"));
      }
    },
    onSuccess: () => {
      setSelectedPresetId("");
      setPresetName("");
      setPresetAsDefault(false);
      setInfoMessage("Пресет сессий удален");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-session-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка удаления пресета");
    }
  });

  const handleBulkByFilters = (): void => {
    const normalizedSearch = debouncedSearch.trim();
    if (!normalizedSearch) {
      setInfoMessage("");
      setErrorMessage("Для bulk-операции по фильтрам укажите поиск по email");
      return;
    }

    bulkRevokeMutation.mutate({
      search: normalizedSearch,
      status: status || "ACTIVE",
      limit: bulkLimit,
      dryRun: bulkDryRun
    });
  };

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

  const activeFiltersCount = countActiveFilters([
    debouncedSearch.trim().length > 0,
    status !== "ACTIVE",
    pageSize !== 20
  ]);

  return (
    <section className="space-y-4">
      <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Поиск по email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | SessionStatus)}
          >
            <option value="ACTIVE">Активные (по умолчанию)</option>
            <option value="">Все статусы</option>
            <option value="REVOKED">Завершенные</option>
            <option value="EXPIRED">Истекшие</option>
          </select>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={String(pageSize)}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            <option value="10">10 на страницу</option>
            <option value="20">20 на страницу</option>
            <option value="50">50 на страницу</option>
          </select>
          <input
            type="number"
            min={1}
            max={200}
            value={bulkLimit}
            onChange={(event) => setBulkLimit(Math.min(200, Math.max(1, Number(event.target.value) || 1)))}
            className="w-24 rounded-md border bg-background px-3 py-2 text-sm"
            aria-label="Лимит bulk"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={bulkDryRun}
              onChange={(event) => setBulkDryRun(event.target.checked)}
            />
            Проверка
          </label>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            disabled={revokeMutation.isPending || bulkRevokeMutation.isPending}
            onClick={handleBulkByFilters}
          >
            Bulk по фильтрам
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary"
            onClick={() => void copyFiltersLink()}
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
              setStatus("ACTIVE");
              setSearchInput("");
              setInfoMessage("");
              setErrorMessage("");
            }}
          >
            Сбросить фильтры
            {activeFiltersCount > 0 ? (
              <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{activeFiltersCount}</span>
            ) : null}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className="rounded-full border px-2 py-1 hover:border-primary hover:text-primary"
            onClick={() => setStatus("ACTIVE")}
          >
            Быстро: активные
          </button>
          <button
            type="button"
            className="rounded-full border px-2 py-1 hover:border-primary hover:text-primary"
            onClick={() => setStatus("REVOKED")}
          >
            Быстро: завершенные
          </button>
          <button
            type="button"
            className="rounded-full border px-2 py-1 hover:border-primary hover:text-primary"
            onClick={() => setStatus("EXPIRED")}
          >
            Быстро: истекшие
          </button>
        </div>

        <AdminSavedViewsPanel
          presets={presetsQuery.data ?? []}
          selectedPresetId={selectedPresetId}
          presetName={presetName}
          presetAsDefault={presetAsDefault}
          applyDisabled={!selectedPreset || updatePresetMutation.isPending}
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
            setInfoMessage(`Применен пресет: ${selectedPreset.name}`);
            setErrorMessage("");
          }}
          onCreate={() => createPresetMutation.mutate()}
          onUpdate={() => updatePresetMutation.mutate()}
          onDelete={() => deletePresetMutation.mutate()}
        />
      </div>

      {infoMessage ? <p className="text-sm text-primary">{infoMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {sessionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Загружаем сессии...</p> : null}
      {sessionsQuery.isError ? <p className="text-sm text-destructive">Не удалось загрузить сессии.</p> : null}

      {sessionsQuery.data ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3">Пользователь</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Устройство</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Последняя активность</th>
                  <th className="p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {sessionsQuery.data.items.map((session) => (
                  <tr key={session.id} className="border-t">
                    <td className="p-3">{session.user.email}</td>
                    <td className="p-3">{getStatusLabel(session.status)}</td>
                    <td className="p-3">{session.deviceType || "Не определено"}</td>
                    <td className="p-3">{session.ipAddress ?? "Не определено"}</td>
                    <td className="p-3">{formatDate(session.lastSeenAt)}</td>
                    <td className="p-3">
                      {session.status === "ACTIVE" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-40"
                            disabled={revokeMutation.isPending || bulkRevokeMutation.isPending}
                            onClick={() => revokeMutation.mutate(session.id)}
                          >
                            Завершить сессию
                          </button>
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-40"
                            disabled={revokeMutation.isPending || bulkRevokeMutation.isPending}
                            onClick={() =>
                              bulkRevokeMutation.mutate({
                                userId: session.userId,
                                status: "ACTIVE",
                                limit: 200,
                                dryRun: false
                              })
                            }
                          >
                            Завершить все у пользователя
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Страница {sessionsQuery.data.page} из {sessionsQuery.data.totalPages} ({sessionsQuery.data.total} сессий)
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={sessionsQuery.data.page <= 1}
                type="button"
              >
                Назад
              </button>
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.min(sessionsQuery.data.totalPages, current + 1))}
                disabled={sessionsQuery.data.page >= sessionsQuery.data.totalPages}
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
