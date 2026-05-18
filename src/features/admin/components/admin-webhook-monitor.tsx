"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { useDebouncedValue } from "@/features/admin/hooks/use-debounced-value";
import { countActiveFilters } from "@/features/admin/lib/admin-table-utils";
import { AdminSavedViewsPanel } from "@/features/admin/components/admin-saved-views-panel";

type WebhookEventItem = {
  id: string;
  eventId: string;
  eventType: string;
  processedAt: string | null;
  createdAt: string;
};

type PaginatedEvents = {
  items: WebhookEventItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type BulkWebhookResponse = {
  dryRun: boolean;
  matchedCount: number;
  replayedCount: number;
};

type WebhookPresetFiltersPayload = {
  eventType?: string;
  processed?: boolean;
};

type AdminWebhookFilterPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  filters: WebhookPresetFiltersPayload;
};

const formatDate = (value: string | null): string =>
  value
    ? new Date(value).toLocaleString("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "-";

const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const AdminWebhookMonitor = (): JSX.Element => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitFromUrlRef = useRef<boolean>(false);
  const lastSerializedFiltersRef = useRef<string>("");

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [eventTypeInput, setEventTypeInput] = useState<string>("");
  const debouncedEventType = useDebouncedValue(eventTypeInput, 350);
  const [processed, setProcessed] = useState<"" | "true" | "false">("");
  const [bulkLimit, setBulkLimit] = useState<number>(20);
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
    const nextEventType = searchParams.get("eventType") ?? "";
    const nextProcessedRaw = searchParams.get("processed");
    const nextProcessed = nextProcessedRaw === "true" || nextProcessedRaw === "false" ? nextProcessedRaw : "";

    setPage(nextPage);
    setPageSize(nextPageSize);
    setEventTypeInput(nextEventType);
    setProcessed(nextProcessed);

    lastSerializedFiltersRef.current = searchParams.toString();
    didInitFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }
    setPage(1);
  }, [debouncedEventType, processed, pageSize]);

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
    if (debouncedEventType.trim()) {
      params.set("eventType", debouncedEventType.trim());
    }
    if (processed) {
      params.set("processed", processed);
    }

    const serialized = params.toString();
    if (serialized === lastSerializedFiltersRef.current) {
      return;
    }

    lastSerializedFiltersRef.current = serialized;
    const href = serialized ? `${pathname}?${serialized}` : pathname;
    router.replace(href, { scroll: false });
  }, [debouncedEventType, page, pageSize, pathname, processed, router]);

  const queryKey = useMemo(
    () => ["admin-webhooks", page, pageSize, debouncedEventType, processed],
    [debouncedEventType, page, pageSize, processed]
  );

  const eventsQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<PaginatedEvents> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (debouncedEventType.trim()) {
        params.set("eventType", debouncedEventType.trim());
      }
      if (processed) {
        params.set("processed", processed);
      }

      const response = await fetch(`/api/admin/webhooks/stripe?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить webhook-события");
      }

      const payload = (await response.json()) as { success: boolean; data: PaginatedEvents };
      return payload.data;
    }
  });

  const presetsQuery = useQuery({
    queryKey: ["admin-webhook-filter-presets"],
    queryFn: async (): Promise<AdminWebhookFilterPreset[]> => {
      const response = await fetch("/api/admin/webhooks/stripe/presets", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить пресеты webhooks");
      }

      const payload = (await response.json()) as { success: boolean; data: AdminWebhookFilterPreset[] };
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

  const currentFiltersPayload = useMemo<WebhookPresetFiltersPayload>(
    () => ({
      eventType: debouncedEventType.trim() || undefined,
      processed: processed === "" ? undefined : processed === "true"
    }),
    [debouncedEventType, processed]
  );

  const applyPresetFilters = (filters: WebhookPresetFiltersPayload): void => {
    setEventTypeInput(filters.eventType ?? "");
    if (filters.processed === undefined) {
      setProcessed("");
    } else {
      setProcessed(filters.processed ? "true" : "false");
    }
    setPage(1);
  };

  const replayMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({ eventId })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось повторно обработать событие"));
      }
    },
    onSuccess: () => {
      setInfoMessage("Событие отправлено на повторную обработку");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка повторной обработки события");
    }
  });

  const bulkReplayMutation = useMutation({
    mutationFn: async (): Promise<BulkWebhookResponse> => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/webhooks/stripe/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          eventType: debouncedEventType.trim() || undefined,
          processed: processed === "" ? undefined : processed === "true",
          limit: bulkLimit,
          dryRun: bulkDryRun
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: BulkWebhookResponse;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось выполнить массовую переобработку");
      }

      return payload.data;
    },
    onSuccess: (result) => {
      if (result.dryRun) {
        setInfoMessage(`Проверка: найдено ${result.matchedCount} событий, изменений не внесено`);
      } else {
        setInfoMessage(`Переобработано событий: ${result.replayedCount} (совпадений: ${result.matchedCount})`);
      }
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка массовой переобработки");
    }
  });

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/webhooks/stripe/presets", {
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
        data?: AdminWebhookFilterPreset;
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
      setInfoMessage("Пресет webhooks сохранен");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-filter-presets"] });
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
      const response = await fetch(`/api/admin/webhooks/stripe/presets/${encodeURIComponent(selectedPresetId)}`, {
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
        data?: AdminWebhookFilterPreset;
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
      setInfoMessage("Пресет webhooks обновлен");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-filter-presets"] });
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
      const response = await fetch(`/api/admin/webhooks/stripe/presets/${encodeURIComponent(selectedPresetId)}`, {
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
      setInfoMessage("Пресет webhooks удален");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка удаления пресета");
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

  const activeFiltersCount = countActiveFilters([
    debouncedEventType.trim().length > 0,
    processed === "true" || processed === "false",
    pageSize !== 20
  ]);

  const quickEventTypes = useMemo(
    () =>
      Array.from(
        new Set((eventsQuery.data?.items ?? []).map((item) => item.eventType).filter((item) => item.trim().length > 0))
      ).slice(0, 6),
    [eventsQuery.data?.items]
  );

  return (
    <section className="space-y-4">
      <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Тип события, например checkout.session.completed"
            value={eventTypeInput}
            onChange={(event) => setEventTypeInput(event.target.value)}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={processed}
            onChange={(event) => setProcessed(event.target.value as "" | "true" | "false")}
          >
            <option value="">Все</option>
            <option value="true">Обработанные</option>
            <option value="false">Необработанные</option>
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
            max={100}
            value={bulkLimit}
            onChange={(event) => setBulkLimit(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
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
            disabled={bulkReplayMutation.isPending || replayMutation.isPending}
            onClick={() => bulkReplayMutation.mutate()}
          >
            Массовый повтор обработки
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
              setEventTypeInput("");
              setProcessed("");
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
            onClick={() => setProcessed("false")}
          >
            Быстро: необработанные
          </button>
          <button
            type="button"
            className="rounded-full border px-2 py-1 hover:border-primary hover:text-primary"
            onClick={() => setProcessed("true")}
          >
            Быстро: обработанные
          </button>
          {quickEventTypes.map((eventType) => (
            <button
              key={eventType}
              type="button"
              className="rounded-full border px-2 py-1 hover:border-primary hover:text-primary"
              onClick={() => setEventTypeInput(eventType)}
            >
              event: {eventType}
            </button>
          ))}
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

      {eventsQuery.isLoading ? <p className="text-sm text-muted-foreground">Загружаем webhook-события...</p> : null}
      {eventsQuery.isError ? <p className="text-sm text-destructive">Не удалось загрузить webhook-события.</p> : null}

      {eventsQuery.data ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3">Event ID</th>
                  <th className="p-3">Тип</th>
                  <th className="p-3">Создан</th>
                  <th className="p-3">Обработан</th>
                  <th className="p-3">Действие</th>
                </tr>
              </thead>
              <tbody>
                {eventsQuery.data.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">{item.eventId}</td>
                    <td className="p-3">{item.eventType}</td>
                    <td className="p-3">{formatDate(item.createdAt)}</td>
                    <td className="p-3">{formatDate(item.processedAt)}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-40"
                        disabled={replayMutation.isPending || bulkReplayMutation.isPending}
                        onClick={() => replayMutation.mutate(item.eventId)}
                      >
                        Повторить обработку
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Страница {eventsQuery.data.page} из {eventsQuery.data.totalPages} ({eventsQuery.data.total} событий)
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={eventsQuery.data.page <= 1}
                type="button"
              >
                Назад
              </button>
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.min(eventsQuery.data.totalPages, current + 1))}
                disabled={eventsQuery.data.page >= eventsQuery.data.totalPages}
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
