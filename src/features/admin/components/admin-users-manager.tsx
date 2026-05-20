"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { useDebouncedValue } from "@/features/admin/hooks/use-debounced-value";
import { countActiveFilters } from "@/features/admin/lib/admin-table-utils";
import { AdminSavedViewsPanel } from "@/features/admin/components/admin-saved-views-panel";
import { downloadCsvFromResponse } from "@/features/admin/lib/file-download";
import { AdminStateBlock } from "@/features/admin/components/admin-state-block";

type UserRole = "USER" | "ADMIN";
type UserBlockedFilter = "" | "true" | "false";
type UserBulkOperation = "SET_ROLE_ADMIN" | "SET_ROLE_USER" | "BLOCK" | "UNBLOCK";

type AuthMePayload = {
  id: string;
  email: string;
  role: UserRole;
  twoFactorEnabled: boolean;
};

type AdminUserItem = {
  id: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
};

type PaginatedUsers = {
  items: AdminUserItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type UserPresetFiltersPayload = {
  search?: string;
  role?: UserRole;
  isBlocked?: boolean;
};

type AdminUserFilterPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  filters: UserPresetFiltersPayload;
};

type UserBulkEvaluationItem = {
  userId: string;
  fromRole: UserRole;
  toRole: UserRole;
  fromBlocked: boolean;
  toBlocked: boolean;
  reason?: string | null;
};

type UserBulkRejectedItem = {
  userId: string;
  reason: string;
};

type BulkDryRunResult = {
  dryRun: true;
  operation: UserBulkOperation;
  operationLabel: string;
  requestedCount: number;
  eligibleCount: number;
  rejectedCount: number;
  eligible: UserBulkEvaluationItem[];
  rejected: UserBulkRejectedItem[];
};

type BulkApplyResult = {
  dryRun: false;
  operation: UserBulkOperation;
  operationLabel: string;
  requestedCount: number;
  updatedCount: number;
  rejectedCount: number;
  updatedUserIds: string[];
  rejected: UserBulkRejectedItem[];
};

const PAGE_SIZE = 20;

const operationLabelMap: Record<UserBulkOperation, string> = {
  SET_ROLE_ADMIN: "Назначить роль ADMIN",
  SET_ROLE_USER: "Назначить роль USER",
  BLOCK: "Заблокировать",
  UNBLOCK: "Разблокировать"
};

const formatDate = (value: string): string =>
  new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

const mapBooleanToFilter = (value?: boolean): UserBlockedFilter => {
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  return "";
};

const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const AdminUsersManager = (): JSX.Element => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitFromUrlRef = useRef<boolean>(false);
  const lastSerializedFiltersRef = useRef<string>("");

  const [page, setPage] = useState<number>(1);
  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [role, setRole] = useState<"" | UserRole>("");
  const [isBlockedFilter, setIsBlockedFilter] = useState<UserBlockedFilter>("");

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkOperation, setBulkOperation] = useState<UserBulkOperation>("BLOCK");
  const [bulkDryRun, setBulkDryRun] = useState<boolean>(true);
  const [bulkResult, setBulkResult] = useState<BulkDryRunResult | BulkApplyResult | null>(null);

  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [presetName, setPresetName] = useState<string>("");
  const [presetAsDefault, setPresetAsDefault] = useState<boolean>(false);

  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied" | "error">("idle");
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (didInitFromUrlRef.current) {
      return;
    }

    const nextPageRaw = Number(searchParams.get("page") ?? "1");
    const nextPage = Number.isFinite(nextPageRaw) && nextPageRaw > 0 ? Math.floor(nextPageRaw) : 1;
    const nextSearch = searchParams.get("search") ?? "";
    const nextRoleRaw = searchParams.get("role");
    const nextRole = nextRoleRaw === "ADMIN" || nextRoleRaw === "USER" ? nextRoleRaw : "";
    const nextBlockedRaw = searchParams.get("isBlocked");
    const nextBlocked = nextBlockedRaw === "true" || nextBlockedRaw === "false" ? nextBlockedRaw : "";

    setPage(nextPage);
    setSearchInput(nextSearch);
    setRole(nextRole);
    setIsBlockedFilter(nextBlocked);

    lastSerializedFiltersRef.current = searchParams.toString();
    didInitFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }
    setPage(1);
  }, [debouncedSearch, role, isBlockedFilter]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }

    const params = new URLSearchParams();
    if (page > 1) {
      params.set("page", String(page));
    }
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (role) {
      params.set("role", role);
    }
    if (isBlockedFilter) {
      params.set("isBlocked", isBlockedFilter);
    }

    const serialized = params.toString();
    if (serialized === lastSerializedFiltersRef.current) {
      return;
    }

    lastSerializedFiltersRef.current = serialized;
    const href = serialized ? `${pathname}?${serialized}` : pathname;
    router.replace(href, { scroll: false });
  }, [debouncedSearch, isBlockedFilter, page, pathname, role, router]);

  const meQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: async (): Promise<AuthMePayload> => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось получить профиль администратора");
      }
      const payload = (await response.json()) as { success: boolean; data: AuthMePayload };
      return payload.data;
    }
  });

  const usersQueryKey = useMemo(
    () => ["admin-users", page, debouncedSearch, role, isBlockedFilter],
    [debouncedSearch, isBlockedFilter, page, role]
  );

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: async (): Promise<PaginatedUsers> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE)
      });
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (role) {
        params.set("role", role);
      }
      if (isBlockedFilter) {
        params.set("isBlocked", isBlockedFilter);
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить пользователей");
      }

      const payload = (await response.json()) as { success: boolean; data: PaginatedUsers };
      return payload.data;
    }
  });

  const presetsQuery = useQuery({
    queryKey: ["admin-user-filter-presets"],
    queryFn: async (): Promise<AdminUserFilterPreset[]> => {
      const response = await fetch("/api/admin/users/presets", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить пресеты пользователей");
      }
      const payload = (await response.json()) as { success: boolean; data: AdminUserFilterPreset[] };
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

  const currentFiltersPayload = useMemo<UserPresetFiltersPayload>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      role: role || undefined,
      isBlocked: isBlockedFilter ? isBlockedFilter === "true" : undefined
    }),
    [debouncedSearch, isBlockedFilter, role]
  );

  const applyPresetFilters = (filters: UserPresetFiltersPayload): void => {
    setSearchInput(filters.search ?? "");
    setRole(filters.role ?? "");
    setIsBlockedFilter(mapBooleanToFilter(filters.isBlocked));
    setPage(1);
    setSelectedUserIds([]);
    setBulkResult(null);
  };

  const updateUserMutation = useMutation({
    mutationFn: async (payload: { userId: string; patch: { role?: UserRole; isBlocked?: boolean } }) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(payload.userId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify(payload.patch)
      });

      const body = (await response.json()) as {
        success: boolean;
        data?: AdminUserItem;
        error?: { message?: string };
      };

      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error?.message ?? "Не удалось обновить пользователя");
      }
      return body.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: usersQueryKey });
      const previous = queryClient.getQueryData<PaginatedUsers>(usersQueryKey);

      if (previous) {
        queryClient.setQueryData<PaginatedUsers>(usersQueryKey, {
          ...previous,
          items: previous.items.map((user) =>
            user.id === payload.userId
              ? {
                  ...user,
                  role: payload.patch.role ?? user.role,
                  isBlocked: payload.patch.isBlocked ?? user.isBlocked
                }
              : user
          )
        });
      }
      return { previous };
    },
    onError: (error: unknown, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(usersQueryKey, context.previous);
      }
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления пользователя");
    },
    onSuccess: () => {
      setErrorMessage("");
      setInfoMessage("Пользователь обновлен");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });

  const bulkMutation = useMutation({
    mutationFn: async (): Promise<BulkDryRunResult | BulkApplyResult> => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          userIds: selectedUserIds,
          operation: bulkOperation,
          dryRun: bulkDryRun
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: BulkDryRunResult | BulkApplyResult;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось выполнить bulk-операцию");
      }
      return payload.data;
    },
    onSuccess: (result) => {
      setBulkResult(result);
      setErrorMessage("");
      if (result.dryRun) {
        setInfoMessage(
          `Проверка: подходят ${result.eligibleCount}, отклонены ${result.rejectedCount}`
        );
      } else {
        setInfoMessage(
          `Операция применена: обновлено ${result.updatedCount}, отклонены ${result.rejectedCount}`
        );
        setSelectedUserIds([]);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка bulk-операции");
    }
  });

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/users/presets", {
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
        data?: AdminUserFilterPreset;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось создать пресет");
      }
      return payload.data;
    },
    onSuccess: (preset) => {
      setSelectedPresetId(preset.id);
      setPresetName(preset.name);
      setPresetAsDefault(false);
      setErrorMessage("");
      setInfoMessage("Пресет сохранен");
      queryClient.invalidateQueries({ queryKey: ["admin-user-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка сохранения пресета");
    }
  });

  const updatePresetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPresetId) {
        throw new Error("Сначала выберите пресет");
      }

      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/users/presets/${encodeURIComponent(selectedPresetId)}`, {
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
        data?: AdminUserFilterPreset;
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
      setErrorMessage("");
      setInfoMessage("Пресет обновлен");
      queryClient.invalidateQueries({ queryKey: ["admin-user-filter-presets"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления пресета");
    }
  });

  const deletePresetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPresetId) {
        throw new Error("Сначала выберите пресет");
      }

      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/users/presets/${encodeURIComponent(selectedPresetId)}`, {
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
      setErrorMessage("");
      setInfoMessage("Пресет удален");
      queryClient.invalidateQueries({ queryKey: ["admin-user-filter-presets"] });
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
      setInfoMessage("Ссылка на фильтры скопирована");
      setErrorMessage("");
      setTimeout(() => setCopyLinkState("idle"), 2000);
    } catch {
      setCopyLinkState("error");
      setErrorMessage("Не удалось скопировать ссылку");
      setTimeout(() => setCopyLinkState("idle"), 2000);
    }
  };

  const exportCsvMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({
        limit: "1000"
      });

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (role) {
        params.set("role", role);
      }
      if (isBlockedFilter) {
        params.set("isBlocked", isBlockedFilter);
      }

      const response = await fetch(`/api/admin/users/export?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось экспортировать CSV пользователей"));
      }

      return downloadCsvFromResponse(response, "users_export.csv");
    },
    onSuccess: (result) => {
      const countText = result.exportedCount !== null ? ` (${result.exportedCount} строк)` : "";
      setInfoMessage(`CSV пользователей выгружен${countText}`);
      setErrorMessage("");
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка при экспорте CSV");
    }
  });

  const loadedUserIds = usersQuery.data?.items.map((item) => item.id) ?? [];
  const selectedLoadedIds = loadedUserIds.filter((id) => selectedUserIds.includes(id));
  const allSelectedLoaded = loadedUserIds.length > 0 && selectedLoadedIds.length === loadedUserIds.length;
  const hasUserRows = loadedUserIds.length > 0;

  const activeFiltersCount = countActiveFilters([
    debouncedSearch.trim().length > 0,
    Boolean(role),
    Boolean(isBlockedFilter)
  ]);

  const toggleUserSelection = (userId: string): void => {
    setSelectedUserIds((current) => {
      if (current.includes(userId)) {
        return current.filter((item) => item !== userId);
      }
      return [...current, userId];
    });
  };

  const toggleSelectLoaded = (): void => {
    if (allSelectedLoaded) {
      setSelectedUserIds((current) => current.filter((id) => !loadedUserIds.includes(id)));
      return;
    }
    setSelectedUserIds((current) => Array.from(new Set([...current, ...loadedUserIds])));
  };

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Пользователи</h2>

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Поиск по email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />

          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as "" | UserRole)}
          >
            <option value="">Все роли</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={isBlockedFilter}
            onChange={(event) => setIsBlockedFilter(event.target.value as UserBlockedFilter)}
          >
            <option value="">Любой статус</option>
            <option value="false">Активные</option>
            <option value="true">Заблокированные</option>
          </select>

          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary"
            onClick={() => void copyFiltersLink()}
          >
            {copyLinkState === "copied" ? "Ссылка скопирована" : copyLinkState === "error" ? "Ошибка копирования" : "Скопировать ссылку"}
          </button>

          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
            onClick={() => exportCsvMutation.mutate()}
            disabled={exportCsvMutation.isPending}
          >
            {exportCsvMutation.isPending ? "Выгружаем CSV..." : "Экспорт CSV"}
          </button>

          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary"
            onClick={() => {
              setPage(1);
              setSearchInput("");
              setRole("");
              setIsBlockedFilter("");
              setSelectedUserIds([]);
              setBulkResult(null);
            }}
          >
            Сбросить фильтры
            {activeFiltersCount > 0 ? (
              <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{activeFiltersCount}</span>
            ) : null}
          </button>
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
            setInfoMessage(`Применен пресет: ${selectedPreset.name}`);
            setErrorMessage("");
          }}
          onCreate={() => createPresetMutation.mutate()}
          onUpdate={() => updatePresetMutation.mutate()}
          onDelete={() => deletePresetMutation.mutate()}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-2 py-1">
            Найдено пользователей: {usersQuery.data ? usersQuery.data.total : "—"}
          </span>
          <span className="rounded-full border px-2 py-1">Активных фильтров: {activeFiltersCount}</span>
          <span className="rounded-full border px-2 py-1">Выбрано в bulk: {selectedUserIds.length}</span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Массовые операции</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={bulkOperation}
            onChange={(event) => setBulkOperation(event.target.value as UserBulkOperation)}
          >
            <option value="SET_ROLE_ADMIN">{operationLabelMap.SET_ROLE_ADMIN}</option>
            <option value="SET_ROLE_USER">{operationLabelMap.SET_ROLE_USER}</option>
            <option value="BLOCK">{operationLabelMap.BLOCK}</option>
            <option value="UNBLOCK">{operationLabelMap.UNBLOCK}</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={bulkDryRun} onChange={(event) => setBulkDryRun(event.target.checked)} />
            Проверка (dry-run)
          </label>

          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            disabled={bulkMutation.isPending || selectedUserIds.length === 0}
            onClick={() => bulkMutation.mutate()}
          >
            Выполнить
          </button>

          <span className="text-xs text-muted-foreground">Выбрано пользователей: {selectedUserIds.length}</span>
        </div>

        {bulkResult ? (
          <div className="mt-3 rounded-md border p-3 text-xs">
            {bulkResult.dryRun ? (
              <p>
                Проверка ({bulkResult.operationLabel}): подходят {bulkResult.eligibleCount}, отклонены {bulkResult.rejectedCount}.
              </p>
            ) : (
              <p>
                Выполнено ({bulkResult.operationLabel}): обновлено {bulkResult.updatedCount}, отклонены {bulkResult.rejectedCount}.
              </p>
            )}

            {bulkResult.rejected.length > 0 ? (
              <div className="mt-2 space-y-1">
                {bulkResult.rejected.slice(0, 10).map((item) => (
                  <p key={item.userId}>
                    {item.userId}: {item.reason}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {infoMessage ? <p className="text-sm text-primary">{infoMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {usersQuery.isLoading ? (
        <AdminStateBlock
          title="Загружаем пользователей"
          description="Подготавливаем список пользователей по текущим фильтрам."
        />
      ) : null}
      {usersQuery.isError ? (
        <AdminStateBlock
          title="Ошибка загрузки пользователей"
          description="Не удалось получить пользователей. Повтори запрос."
          actionLabel="Повторить"
          onAction={() => {
            void usersQuery.refetch();
          }}
          tone="error"
        />
      ) : null}

      {usersQuery.data ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3">
                    <input
                      type="checkbox"
                      checked={allSelectedLoaded}
                      onChange={toggleSelectLoaded}
                      disabled={!hasUserRows}
                      aria-label="Выбрать всех пользователей на странице"
                    />
                  </th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Роль</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Создан</th>
                  <th className="p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {hasUserRows ? (
                  usersQuery.data.items.map((user) => {
                    const isSelf = meQuery.data?.id === user.id;
                    return (
                      <tr key={user.id} className="border-t">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            disabled={isSelf}
                            aria-label={`Выбрать пользователя ${user.email}`}
                          />
                        </td>
                        <td className="p-3">
                          {user.email}
                          {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(вы)</span> : null}
                        </td>
                        <td className="p-3">{user.role}</td>
                        <td className="p-3">{user.isBlocked ? "Заблокирован" : "Активен"}</td>
                        <td className="p-3">{formatDate(user.createdAt)}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-40"
                              disabled={updateUserMutation.isPending || isSelf || user.role === "ADMIN"}
                              onClick={() => updateUserMutation.mutate({ userId: user.id, patch: { role: "ADMIN" } })}
                            >
                              Сделать ADMIN
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-40"
                              disabled={updateUserMutation.isPending || isSelf || user.role === "USER"}
                              onClick={() => updateUserMutation.mutate({ userId: user.id, patch: { role: "USER" } })}
                            >
                              Сделать USER
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:border-destructive hover:text-destructive disabled:opacity-40"
                              disabled={updateUserMutation.isPending || isSelf}
                              onClick={() =>
                                updateUserMutation.mutate({
                                  userId: user.id,
                                  patch: { isBlocked: !user.isBlocked }
                                })
                              }
                            >
                              {user.isBlocked ? "Разблокировать" : "Заблокировать"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="border-t">
                    <td className="p-6 text-sm text-muted-foreground" colSpan={6}>
                      Пользователи по текущим фильтрам не найдены. Измени фильтры или сбрось их и попробуй снова.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Страница {usersQuery.data.page} из {usersQuery.data.totalPages} ({usersQuery.data.total} пользователей)
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={usersQuery.data.page <= 1}
                type="button"
              >
                Назад
              </button>
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.min(usersQuery.data.totalPages, current + 1))}
                disabled={usersQuery.data.page >= usersQuery.data.totalPages}
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

