"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { useDebouncedValue } from "@/features/admin/hooks/use-debounced-value";
import { countActiveFilters } from "@/features/admin/lib/admin-table-utils";
import { downloadCsvFromResponse } from "@/features/admin/lib/file-download";
import { AdminSavedViewsPanel } from "@/features/admin/components/admin-saved-views-panel";
import { AdminStateBlock } from "@/features/admin/components/admin-state-block";

type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type ContentPostItem = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};

type PaginatedPosts = {
  items: ContentPostItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ContentPresetFiltersPayload = {
  search?: string;
  status?: ContentStatus;
};

type AdminContentFilterPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  filters: ContentPresetFiltersPayload;
};

type CreateFormState = {
  slug: string;
  title: string;
  content: string;
  status: ContentStatus;
};

type ContentBulkRejectedItem = {
  postId: string;
  slug: string;
  reason: string;
};

type ContentBulkDryRunResult = {
  dryRun: true;
  requestedCount: number;
  eligibleCount: number;
  rejectedCount: number;
  rejected: ContentBulkRejectedItem[];
};

type ContentBulkApplyResult = {
  dryRun: false;
  requestedCount: number;
  updatedCount: number;
  rejectedCount: number;
  updatedPostIds: string[];
  rejected: ContentBulkRejectedItem[];
};

type ContentBulkResult = ContentBulkDryRunResult | ContentBulkApplyResult;

type ContentQuickFilters = {
  generatedAt: string;
  counts: Record<ContentStatus, number> & { total: number };
};

const PAGE_SIZES = [10, 20, 50] as const;
const contentStatusLabels: Record<ContentStatus, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "Архив"
};

const initialCreateForm: CreateFormState = {
  slug: "",
  title: "",
  content: "",
  status: "DRAFT"
};

const formatDate = (value: string): string =>
  new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const AdminContentManager = (): JSX.Element => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const didInitFromUrlRef = useRef<boolean>(false);
  const lastSerializedFiltersRef = useRef<string>("");

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [statusFilter, setStatusFilter] = useState<"" | ContentStatus>("");

  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ContentStatus>("PUBLISHED");
  const [bulkDryRun, setBulkDryRun] = useState<boolean>(true);
  const [bulkResult, setBulkResult] = useState<ContentBulkResult | null>(null);

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
    const nextPageSize = PAGE_SIZES.includes(nextPageSizeRaw as (typeof PAGE_SIZES)[number]) ? nextPageSizeRaw : 20;

    const nextSearch = searchParams.get("search") ?? "";
    const nextStatusRaw = searchParams.get("status");
    const nextStatus =
      nextStatusRaw === "DRAFT" || nextStatusRaw === "PUBLISHED" || nextStatusRaw === "ARCHIVED"
        ? nextStatusRaw
        : "";

    setPage(nextPage);
    setPageSize(nextPageSize);
    setSearchInput(nextSearch);
    setStatusFilter(nextStatus);

    lastSerializedFiltersRef.current = searchParams.toString();
    didInitFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }
    setPage(1);
  }, [debouncedSearch, pageSize, statusFilter]);

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
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (statusFilter) {
      params.set("status", statusFilter);
    }

    const serialized = params.toString();
    if (serialized === lastSerializedFiltersRef.current) {
      return;
    }

    lastSerializedFiltersRef.current = serialized;
    const href = serialized ? `${pathname}?${serialized}` : pathname;
    router.replace(href, { scroll: false });
  }, [debouncedSearch, page, pageSize, pathname, router, statusFilter]);

  const queryKey = useMemo(
    () => ["admin-content-posts", page, pageSize, debouncedSearch, statusFilter],
    [debouncedSearch, page, pageSize, statusFilter]
  );

  const postsQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<PaginatedPosts> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/admin/content?${params.toString()}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить публикации");
      }

      const payload = (await response.json()) as { success: boolean; data: PaginatedPosts };
      return payload.data;
    }
  });

  const presetsQuery = useQuery({
    queryKey: ["admin-content-filter-presets"],
    queryFn: async (): Promise<AdminContentFilterPreset[]> => {
      const response = await fetch("/api/admin/content/presets", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить сохраненные представления контента");
      }

      const payload = (await response.json()) as { success: boolean; data: AdminContentFilterPreset[] };
      return payload.data;
    }
  });

  const quickFiltersQuery = useQuery({
    queryKey: ["admin-content-quick-filters", debouncedSearch],
    queryFn: async (): Promise<ContentQuickFilters> => {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      const response = await fetch(`/api/admin/content/quick-filters?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить быстрые фильтры контента");
      }

      const payload = (await response.json()) as { success: boolean; data: ContentQuickFilters };
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

  const currentFiltersPayload = useMemo<ContentPresetFiltersPayload>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: statusFilter || undefined
    }),
    [debouncedSearch, statusFilter]
  );

  const applyPresetFilters = (filters: ContentPresetFiltersPayload): void => {
    setSearchInput(filters.search ?? "");
    setStatusFilter(filters.status ?? "");
    setPage(1);
    setSelectedPostIds([]);
    setBulkResult(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify(createForm)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось создать публикацию"));
      }
    },
    onSuccess: () => {
      setInfoMessage("Публикация создана");
      setErrorMessage("");
      setCreateForm(initialCreateForm);
      queryClient.invalidateQueries({ queryKey: ["admin-content-posts"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при создании публикации");
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { postId: string; status: ContentStatus }) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/content/${encodeURIComponent(payload.postId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({ status: payload.status })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось обновить статус публикации"));
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PaginatedPosts>(queryKey);

      if (previous) {
        queryClient.setQueryData<PaginatedPosts>(queryKey, {
          ...previous,
          items: previous.items.map((post) =>
            post.id === payload.postId ? { ...post, status: payload.status } : post
          )
        });
      }

      return { previous };
    },
    onSuccess: () => {
      setInfoMessage("Статус публикации обновлен");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-content-posts"] });
    },
    onError: (error: unknown, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при обновлении статуса");
    }
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async (): Promise<ContentBulkResult> => {
      if (selectedPostIds.length === 0) {
        throw new Error("Выберите минимум одну публикацию");
      }

      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/content/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          postIds: selectedPostIds,
          status: bulkStatus,
          dryRun: bulkDryRun
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: ContentBulkResult;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось выполнить массовое изменение");
      }
      return payload.data;
    },
    onSuccess: (result) => {
      setBulkResult(result);
      setErrorMessage("");
      if (result.dryRun) {
        setInfoMessage(`Проверка завершена: подходят ${result.eligibleCount}, отклонены ${result.rejectedCount}`);
      } else {
        setInfoMessage(`Изменения применены: обновлены ${result.updatedCount}, отклонены ${result.rejectedCount}`);
        setSelectedPostIds([]);
        queryClient.invalidateQueries({ queryKey: ["admin-content-posts"] });
      }
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при массовом обновлении");
    }
  });

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/content/presets", {
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
        data?: AdminContentFilterPreset;
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
      setInfoMessage("Представление контента сохранено");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-content-filter-presets"] });
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
      const response = await fetch(`/api/admin/content/presets/${encodeURIComponent(selectedPresetId)}`, {
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
        data?: AdminContentFilterPreset;
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
      setInfoMessage("Представление контента обновлено");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-content-filter-presets"] });
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
      const response = await fetch(`/api/admin/content/presets/${encodeURIComponent(selectedPresetId)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
        credentials: "include"
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: { message?: string };
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error?.message ?? "Не удалось удалить представление");
      }
    },
    onSuccess: () => {
      setSelectedPresetId("");
      setPresetName("");
      setPresetAsDefault(false);
      setInfoMessage("Представление контента удалено");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-content-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при удалении представления");
    }
  });

  const exportCsvMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({
        limit: "1000"
      });

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/admin/content/export?${params.toString()}`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось экспортировать CSV контента"));
      }

      return downloadCsvFromResponse(response, "content_export.csv");
    },
    onSuccess: (result) => {
      const countText = result.exportedCount !== null ? ` (${result.exportedCount} строк)` : "";
      setInfoMessage(`CSV контента выгружен${countText}`);
      setErrorMessage("");
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при экспорте CSV");
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
    debouncedSearch.trim().length > 0,
    Boolean(statusFilter),
    pageSize !== 20
  ]);

  const loadedPostIds = postsQuery.data?.items.map((post) => post.id) ?? [];
  const selectedLoadedIds = loadedPostIds.filter((id) => selectedPostIds.includes(id));
  const allLoadedSelected = loadedPostIds.length > 0 && selectedLoadedIds.length === loadedPostIds.length;

  const togglePostSelection = (postId: string): void => {
    setSelectedPostIds((current) => {
      if (current.includes(postId)) {
        return current.filter((item) => item !== postId);
      }
      return [...current, postId];
    });
  };

  const toggleSelectLoaded = (): void => {
    if (allLoadedSelected) {
      setSelectedPostIds((current) => current.filter((id) => !loadedPostIds.includes(id)));
      return;
    }
    setSelectedPostIds((current) => Array.from(new Set([...current, ...loadedPostIds])));
  };

  const selectLoadedByStatus = (status: ContentStatus): void => {
    const idsByStatus = (postsQuery.data?.items ?? [])
      .filter((post) => post.status === status)
      .map((post) => post.id);

    setSelectedPostIds((current) => Array.from(new Set([...current, ...idsByStatus])));
  };

  const statusCounts = quickFiltersQuery.data?.counts ?? {
    DRAFT: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
    total: 0
  };

  const canCreatePost =
    createForm.slug.trim().length > 1 &&
    createForm.title.trim().length > 1 &&
    createForm.content.trim().length >= 10;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Контент и блог</h2>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Новая публикация</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Slug"
            value={createForm.slug}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, slug: event.target.value }))}
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Заголовок"
            value={createForm.title}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={createForm.status}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value as ContentStatus }))}
          >
            <option value="DRAFT">{contentStatusLabels.DRAFT}</option>
            <option value="PUBLISHED">{contentStatusLabels.PUBLISHED}</option>
            <option value="ARCHIVED">{contentStatusLabels.ARCHIVED}</option>
          </select>
          <div />
          <textarea
            className="min-h-[140px] rounded-md border bg-background px-3 py-2 text-sm md:col-span-2"
            placeholder="Текст публикации"
            value={createForm.content}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, content: event.target.value }))}
          />
        </div>
        <div className="mt-3">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            disabled={createMutation.isPending || !canCreatePost}
            onClick={() => createMutation.mutate()}
          >
            Создать публикацию
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-3 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Поиск по заголовку и slug"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "" | ContentStatus);
              setPage(1);
            }}
          >
            <option value="">Все статусы</option>
            <option value="DRAFT">{contentStatusLabels.DRAFT}</option>
            <option value="PUBLISHED">{contentStatusLabels.PUBLISHED}</option>
            <option value="ARCHIVED">{contentStatusLabels.ARCHIVED}</option>
          </select>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
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
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={exportCsvMutation.isPending}
            onClick={() => exportCsvMutation.mutate()}
          >
            {exportCsvMutation.isPending ? "Выгружаем CSV..." : "Экспорт CSV"}
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => {
              setPage(1);
              setPageSize(20);
              setSearchInput("");
              setStatusFilter("");
              setSelectedPostIds([]);
              setBulkResult(null);
            }}
          >
            Сбросить фильтры
            {activeFiltersCount > 0 ? (
              <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{activeFiltersCount}</span>
            ) : null}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {(["DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={`rounded-full border px-2 py-1 hover:border-primary hover:text-primary ${
                statusFilter === status ? "border-primary text-primary" : ""
              }`}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              {contentStatusLabels[status]}: {statusCounts[status]}
            </button>
          ))}
        </div>
        {quickFiltersQuery.data ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Сводка по найденным публикациям: {statusCounts.total} (обновлено {formatDate(quickFiltersQuery.data.generatedAt)})
          </p>
        ) : null}
        {quickFiltersQuery.isLoading ? (
          <p className="mt-2 text-[11px] text-muted-foreground">Загружаем агрегированные счетчики статусов...</p>
        ) : null}
        {quickFiltersQuery.isError ? (
          <p className="mt-2 text-[11px] text-destructive">Не удалось загрузить агрегированные счетчики статусов.</p>
        ) : null}

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
          loadingText="Загружаем представления контента..."
          errorText="Не удалось загрузить представления контента."
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-2 py-1">
            Найдено публикаций: {postsQuery.data ? postsQuery.data.total : "—"}
          </span>
          <span className="rounded-full border px-2 py-1">Активных фильтров: {activeFiltersCount}</span>
          <span className="rounded-full border px-2 py-1">Выбрано в bulk: {selectedPostIds.length}</span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Массовая смена статуса</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as ContentStatus)}
          >
            <option value="DRAFT">{contentStatusLabels.DRAFT}</option>
            <option value="PUBLISHED">{contentStatusLabels.PUBLISHED}</option>
            <option value="ARCHIVED">{contentStatusLabels.ARCHIVED}</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={bulkDryRun} onChange={(event) => setBulkDryRun(event.target.checked)} />
            Проверка (dry-run)
          </label>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            disabled={bulkStatusMutation.isPending || selectedPostIds.length === 0}
            onClick={() => bulkStatusMutation.mutate()}
          >
            Выполнить
          </button>
          <span className="text-xs text-muted-foreground">Выбрано публикаций: {selectedPostIds.length}</span>
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary"
            onClick={toggleSelectLoaded}
            disabled={loadedPostIds.length === 0}
          >
            {allLoadedSelected ? "Снять страницу" : "Выбрать страницу"}
          </button>
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary"
            onClick={() => selectLoadedByStatus("DRAFT")}
            disabled={postsQuery.data?.items.length === 0}
          >
            + Черновики
          </button>
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary"
            onClick={() => selectLoadedByStatus("PUBLISHED")}
            disabled={postsQuery.data?.items.length === 0}
          >
            + Публик.
          </button>
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary"
            onClick={() => setSelectedPostIds([])}
            disabled={selectedPostIds.length === 0}
          >
            Очистить выбор
          </button>
        </div>

        {bulkResult ? (
          <div className="mt-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>
              {bulkResult.dryRun ? "Проверка" : "Применение"}: запрошено {bulkResult.requestedCount}, {" "}
              {bulkResult.dryRun
                ? `подходят ${bulkResult.eligibleCount}`
                : `обновлено ${bulkResult.updatedCount}`}
              , отклонены {bulkResult.rejectedCount}
            </p>
            {bulkResult.rejected.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {bulkResult.rejected.slice(0, 8).map((item) => (
                  <li key={item.postId}>
                    {item.slug}: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {infoMessage ? <p className="text-sm text-primary">{infoMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {postsQuery.isLoading ? (
        <AdminStateBlock
          title="Загружаем публикации"
          description="Подготавливаем список публикаций по текущим фильтрам."
        />
      ) : null}
      {postsQuery.isError ? (
        <AdminStateBlock
          title="Ошибка загрузки публикаций"
          description="Не удалось получить список публикаций. Проверь соединение и попробуй снова."
          actionLabel="Повторить"
          onAction={() => {
            void postsQuery.refetch();
          }}
          tone="error"
        />
      ) : null}

      {postsQuery.data ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3">
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                      onClick={toggleSelectLoaded}
                      disabled={loadedPostIds.length === 0}
                    >
                      {allLoadedSelected ? "Снять" : "Выбрать"}
                    </button>
                  </th>
                  <th className="p-3">Публикация</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {postsQuery.data.items.map((post) => (
                  <tr key={post.id} className="border-t align-top">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Выбрать публикацию ${post.title}`}
                        checked={selectedPostIds.includes(post.id)}
                        onChange={() => togglePostSelection(post.id)}
                      />
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{post.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{post.content}</p>
                    </td>
                    <td className="p-3">{post.slug}</td>
                    <td className="p-3">
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-xs"
                        value={post.status}
                        onChange={(event) =>
                          updateStatusMutation.mutate({
                            postId: post.id,
                            status: event.target.value as ContentStatus
                          })
                        }
                      >
                        <option value="DRAFT">{contentStatusLabels.DRAFT}</option>
                        <option value="PUBLISHED">{contentStatusLabels.PUBLISHED}</option>
                        <option value="ARCHIVED">{contentStatusLabels.ARCHIVED}</option>
                      </select>
                    </td>
                    <td className="p-3">{formatDate(post.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {postsQuery.data.items.length === 0 ? (
            <AdminStateBlock
              title="Публикации не найдены"
              description="По текущим фильтрам нет результатов. Сбрось фильтры или поменяй статус."
              actionLabel="Сбросить фильтры"
              onAction={() => {
                setPage(1);
                setPageSize(20);
                setSearchInput("");
                setStatusFilter("");
              }}
            />
          ) : null}

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Страница {postsQuery.data.page} из {postsQuery.data.totalPages} ({postsQuery.data.total} публикаций)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={postsQuery.data.page <= 1}
              >
                Назад
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.min(postsQuery.data.totalPages, current + 1))}
                disabled={postsQuery.data.page >= postsQuery.data.totalPages}
              >
                Вперед
              </button>
            </div>
          </div>
        </>
      ) : null}

      {selectedPostIds.length > 0 ? (
        <div className="sticky bottom-3 z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Выбрано публикаций: {selectedPostIds.length}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
                onClick={() => setBulkDryRun(true)}
              >
                Режим: Проверка
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
                onClick={() => setBulkDryRun(false)}
              >
                Режим: Применение
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
                onClick={() => bulkStatusMutation.mutate()}
                disabled={bulkStatusMutation.isPending}
              >
                {bulkStatusMutation.isPending ? "Выполняем..." : "Запустить bulk"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
