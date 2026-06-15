"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { formatUsdCents, getOrderStatusLabel } from "@/lib/order-formatters";
import { useDebouncedValue } from "@/features/admin/hooks/use-debounced-value";
import { countActiveFilters } from "@/features/admin/lib/admin-table-utils";
import { AdminSavedViewsPanel } from "@/features/admin/components/admin-saved-views-panel";

type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";

type AdminOrderItem = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
  };
  _count: {
    items: number;
  };
};

type PaginatedOrders = {
  items: AdminOrderItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type AdminOrderDetails = {
  id: string;
  status: OrderStatus;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  shippingAddressJson: unknown;
  billingAddressJson: unknown;
  stripeCheckoutId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
    currency: string;
    customizationId: string | null;
    product: {
      id: string;
      name: string;
      brand: string;
    };
    variant: {
      id: string;
      name: string;
      color: string;
      size: string;
      sku: string;
    };
  }>;
  payments: Array<{
    id: string;
    provider: "STRIPE" | "MANUAL" | "CLOUDPAYMENTS";
    status: "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "REFUNDED";
    amountCents: number;
    currency: string;
    stripePaymentIntentId: string | null;
    stripeChargeId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  _count: {
    items: number;
    payments: number;
  };
  statusTimeline: Array<{
    id: string;
    adminId: string;
    adminEmail: string;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
  }>;
};

type PresetFiltersPayload = {
  search?: string;
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  minTotalCents?: number;
  maxTotalCents?: number;
};

type AdminOrderFilterPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  filters: PresetFiltersPayload;
};

type BulkDryRunResult = {
  dryRun: true;
  requestedCount: number;
  eligibleCount: number;
  rejectedCount: number;
  eligible: Array<{
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    canUpdate: true;
    reason: null;
  }>;
  rejected: Array<{
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    canUpdate: false;
    reason: string;
  }>;
};

type BulkApplyResult = {
  dryRun: false;
  requestedCount: number;
  updatedCount: number;
  rejectedCount: number;
  updatedOrderIds: string[];
  rejected: Array<{
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    canUpdate: false;
    reason: string;
  }>;
};

const ORDER_STATUSES: OrderStatus[] = ["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"];

const ORDER_STATUS_OPTIONS: Array<{ value: "" | OrderStatus; label: string }> = [
  { value: "", label: "Все статусы" },
  { value: "PENDING", label: getOrderStatusLabel("PENDING") },
  { value: "PAID", label: getOrderStatusLabel("PAID") },
  { value: "FULFILLED", label: getOrderStatusLabel("FULFILLED") },
  { value: "CANCELLED", label: getOrderStatusLabel("CANCELLED") },
  { value: "REFUNDED", label: getOrderStatusLabel("REFUNDED") }
];

const nextTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["FULFILLED", "REFUNDED"],
  FULFILLED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: []
};

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

const formatAddressJson = (value: unknown): string => {
  if (!value) {
    return "Нет данных";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Нет данных";
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

export const AdminOrdersManager = (): JSX.Element => {
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
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [minTotalCents, setMinTotalCents] = useState<string>("");
  const [maxTotalCents, setMaxTotalCents] = useState<string>("");

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("FULFILLED");
  const [bulkDryRun, setBulkDryRun] = useState<boolean>(true);
  const [bulkResult, setBulkResult] = useState<BulkDryRunResult | BulkApplyResult | null>(null);

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
    const nextPageSize = nextPageSizeRaw === 20 || nextPageSizeRaw === 50 ? nextPageSizeRaw : 20;
    const nextSearch = searchParams.get("search") ?? "";
    const nextStatusRaw = searchParams.get("status");
    const nextStatus = ORDER_STATUSES.includes(nextStatusRaw as OrderStatus) ? (nextStatusRaw as OrderStatus) : "";
    const nextDateFrom = searchParams.get("dateFrom") ?? "";
    const nextDateTo = searchParams.get("dateTo") ?? "";
    const nextMinTotalCents = searchParams.get("minTotalCents") ?? "";
    const nextMaxTotalCents = searchParams.get("maxTotalCents") ?? "";

    setPage(nextPage);
    setPageSize(nextPageSize);
    setSearchInput(nextSearch);
    setStatus(nextStatus);
    setDateFrom(nextDateFrom);
    setDateTo(nextDateTo);
    setMinTotalCents(nextMinTotalCents);
    setMaxTotalCents(nextMaxTotalCents);

    lastSerializedFiltersRef.current = searchParams.toString();
    didInitFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }
    setPage(1);
  }, [debouncedSearch, status, dateFrom, dateTo, minTotalCents, maxTotalCents, pageSize]);

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
    if (status) {
      params.set("status", status);
    }
    if (dateFrom) {
      params.set("dateFrom", dateFrom);
    }
    if (dateTo) {
      params.set("dateTo", dateTo);
    }
    if (minTotalCents.trim()) {
      params.set("minTotalCents", minTotalCents.trim());
    }
    if (maxTotalCents.trim()) {
      params.set("maxTotalCents", maxTotalCents.trim());
    }

    const serialized = params.toString();
    if (serialized === lastSerializedFiltersRef.current) {
      return;
    }

    lastSerializedFiltersRef.current = serialized;
    const href = serialized ? `${pathname}?${serialized}` : pathname;
    router.replace(href, { scroll: false });
  }, [
    dateFrom,
    dateTo,
    debouncedSearch,
    maxTotalCents,
    minTotalCents,
    page,
    pageSize,
    pathname,
    router,
    status
  ]);

  const normalizedMinTotalCents = minTotalCents.trim() ? Number(minTotalCents) : undefined;
  const normalizedMaxTotalCents = maxTotalCents.trim() ? Number(maxTotalCents) : undefined;

  const queryKey = useMemo(
    () => [
      "admin-orders",
      page,
      pageSize,
      debouncedSearch,
      status,
      dateFrom,
      dateTo,
      normalizedMinTotalCents,
      normalizedMaxTotalCents
    ],
    [
      dateFrom,
      dateTo,
      debouncedSearch,
      normalizedMaxTotalCents,
      normalizedMinTotalCents,
      page,
      pageSize,
      status
    ]
  );

  const ordersQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<PaginatedOrders> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (status) {
        params.set("status", status);
      }
      if (dateFrom) {
        params.set("dateFrom", dateFrom);
      }
      if (dateTo) {
        params.set("dateTo", dateTo);
      }
      if (normalizedMinTotalCents !== undefined && Number.isFinite(normalizedMinTotalCents)) {
        params.set("minTotalCents", String(Math.max(0, Math.floor(normalizedMinTotalCents))));
      }
      if (normalizedMaxTotalCents !== undefined && Number.isFinite(normalizedMaxTotalCents)) {
        params.set("maxTotalCents", String(Math.max(0, Math.floor(normalizedMaxTotalCents))));
      }

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить заказы");
      }

      const payload = (await response.json()) as { success: boolean; data: PaginatedOrders };
      return payload.data;
    }
  });

  const presetsQuery = useQuery({
    queryKey: ["admin-order-filter-presets"],
    queryFn: async (): Promise<AdminOrderFilterPreset[]> => {
      const response = await fetch("/api/admin/orders/presets", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить пресеты фильтров");
      }

      const payload = (await response.json()) as { success: boolean; data: AdminOrderFilterPreset[] };
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

  const currentFiltersPayload = useMemo<PresetFiltersPayload>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: status || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minTotalCents:
        normalizedMinTotalCents !== undefined && Number.isFinite(normalizedMinTotalCents)
          ? Math.max(0, Math.floor(normalizedMinTotalCents))
          : undefined,
      maxTotalCents:
        normalizedMaxTotalCents !== undefined && Number.isFinite(normalizedMaxTotalCents)
          ? Math.max(0, Math.floor(normalizedMaxTotalCents))
          : undefined
    }),
    [
      dateFrom,
      dateTo,
      debouncedSearch,
      normalizedMaxTotalCents,
      normalizedMinTotalCents,
      status
    ]
  );

  const applyPresetFilters = (filters: PresetFiltersPayload): void => {
    setSearchInput(filters.search ?? "");
    setStatus(filters.status ?? "");
    setDateFrom(filters.dateFrom ?? "");
    setDateTo(filters.dateTo ?? "");
    setMinTotalCents(filters.minTotalCents !== undefined ? String(filters.minTotalCents) : "");
    setMaxTotalCents(filters.maxTotalCents !== undefined ? String(filters.maxTotalCents) : "");
    setPage(1);
    setSelectedOrderIds([]);
    setBulkResult(null);
  };

  const detailsQuery = useQuery({
    queryKey: ["admin-order-details", selectedOrderId],
    enabled: Boolean(selectedOrderId),
    queryFn: async (): Promise<AdminOrderDetails> => {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(selectedOrderId ?? "")}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить детали заказа");
      }

      const payload = (await response.json()) as { success: boolean; data: AdminOrderDetails };
      return payload.data;
    }
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async (payload: { orderId: string; status: OrderStatus }) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(payload.orderId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({ status: payload.status })
      });

      const body = (await response.json()) as {
        success: boolean;
        data?: AdminOrderItem;
        error?: { message?: string };
      };
      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error?.message ?? "Не удалось изменить статус заказа");
      }
      return body.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PaginatedOrders>(queryKey);

      if (previous) {
        queryClient.setQueryData<PaginatedOrders>(queryKey, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === payload.orderId ? { ...item, status: payload.status } : item
          )
        });
      }

      return { previous };
    },
    onError: (error: unknown, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления заказа");
    },
    onSuccess: () => {
      setInfoMessage("Статус заказа обновлен");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-details"] });
    }
  });

  const bulkMutation = useMutation({
    mutationFn: async (): Promise<BulkDryRunResult | BulkApplyResult> => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          status: bulkStatus,
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
        setInfoMessage(`Проверка: можно обновить ${result.eligibleCount}, отклонено ${result.rejectedCount}`);
      } else {
        setInfoMessage(`Обновлено заказов: ${result.updatedCount}, отклонено ${result.rejectedCount}`);
        setSelectedOrderIds([]);
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      }
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка bulk-операции");
    }
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ limit: "1000" });
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (status) {
        params.set("status", status);
      }
      if (dateFrom) {
        params.set("dateFrom", dateFrom);
      }
      if (dateTo) {
        params.set("dateTo", dateTo);
      }
      if (normalizedMinTotalCents !== undefined && Number.isFinite(normalizedMinTotalCents)) {
        params.set("minTotalCents", String(Math.max(0, Math.floor(normalizedMinTotalCents))));
      }
      if (normalizedMaxTotalCents !== undefined && Number.isFinite(normalizedMaxTotalCents)) {
        params.set("maxTotalCents", String(Math.max(0, Math.floor(normalizedMaxTotalCents))));
      }

      const response = await fetch(`/api/admin/orders/export?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось экспортировать заказы"));
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      const filename = contentDisposition?.match(/filename="(.+?)"/)?.[1] ?? "orders_export.csv";

      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    },
    onSuccess: () => {
      setInfoMessage("Экспорт CSV сформирован");
      setErrorMessage("");
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка экспорта");
    }
  });

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/orders/presets", {
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
        data?: AdminOrderFilterPreset;
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
      setInfoMessage("Пресет заказов сохранен");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-order-filter-presets"] });
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
      const response = await fetch(`/api/admin/orders/presets/${encodeURIComponent(selectedPresetId)}`, {
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
        data?: AdminOrderFilterPreset;
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
      setInfoMessage("Пресет заказов обновлен");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-order-filter-presets"] });
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
      const response = await fetch(`/api/admin/orders/presets/${encodeURIComponent(selectedPresetId)}`, {
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
      setInfoMessage("Пресет заказов удален");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-order-filter-presets"] });
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
    debouncedSearch.trim().length > 0,
    Boolean(status),
    Boolean(dateFrom),
    Boolean(dateTo),
    minTotalCents.trim().length > 0,
    maxTotalCents.trim().length > 0,
    pageSize !== 20
  ]);

  const loadedOrderIds = ordersQuery.data?.items.map((item) => item.id) ?? [];
  const selectedLoadedIds = loadedOrderIds.filter((id) => selectedOrderIds.includes(id));
  const allSelectedLoaded = loadedOrderIds.length > 0 && selectedLoadedIds.length === loadedOrderIds.length;

  const toggleOrderSelection = (orderId: string): void => {
    setSelectedOrderIds((current) => {
      if (current.includes(orderId)) {
        return current.filter((item) => item !== orderId);
      }
      return [...current, orderId];
    });
  };

  const toggleSelectLoaded = (): void => {
    if (allSelectedLoaded) {
      setSelectedOrderIds((current) => current.filter((id) => !loadedOrderIds.includes(id)));
      return;
    }
    setSelectedOrderIds((current) => Array.from(new Set([...current, ...loadedOrderIds])));
  };

  const statusCounts = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      PENDING: 0,
      PAID: 0,
      FULFILLED: 0,
      CANCELLED: 0,
      REFUNDED: 0
    };
    for (const item of ordersQuery.data?.items ?? []) {
      counts[item.status] += 1;
    }
    return counts;
  }, [ordersQuery.data?.items]);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Заказы</h2>

      <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-3 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Поиск по email или ID заказа"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | OrderStatus)}
          >
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <input
            type="date"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
          <input
            type="number"
            min={0}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Мин. сумма (cents)"
            value={minTotalCents}
            onChange={(event) => setMinTotalCents(event.target.value)}
          />
          <input
            type="number"
            min={0}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Макс. сумма (cents)"
            value={maxTotalCents}
            onChange={(event) => setMaxTotalCents(event.target.value)}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={String(pageSize)}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            <option value="20">20 на страницу</option>
            <option value="50">50 на страницу</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              className="w-full rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              Экспорт CSV
            </button>
            <button
              type="button"
              className="w-full rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary"
              onClick={() => void copyFiltersLink()}
            >
              {copyLinkState === "copied"
                ? "Ссылка скопирована"
                : copyLinkState === "error"
                  ? "Ошибка копирования"
                  : "Скопировать ссылку"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {ORDER_STATUSES.map((itemStatus) => (
            <button
              key={itemStatus}
              type="button"
              className={`rounded-full border px-2 py-1 hover:border-primary hover:text-primary ${
                status === itemStatus ? "border-primary text-primary" : ""
              }`}
              onClick={() => setStatus(itemStatus)}
            >
              {getOrderStatusLabel(itemStatus)}: {statusCounts[itemStatus]}
            </button>
          ))}
          <button
            type="button"
            className="rounded-full border px-2 py-1 hover:border-primary hover:text-primary"
            onClick={() => {
              setPage(1);
              setPageSize(20);
              setSearchInput("");
              setStatus("");
              setDateFrom("");
              setDateTo("");
              setMinTotalCents("");
              setMaxTotalCents("");
              setSelectedOrderIds([]);
              setBulkResult(null);
            }}
          >
            Сбросить фильтры
            {activeFiltersCount > 0 ? <span className="ml-2">{activeFiltersCount}</span> : null}
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

      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Массовое обновление</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as OrderStatus)}
          >
            {ORDER_STATUSES.map((itemStatus) => (
              <option key={itemStatus} value={itemStatus}>
                {getOrderStatusLabel(itemStatus)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={bulkDryRun} onChange={(event) => setBulkDryRun(event.target.checked)} />
            Проверка (dry-run)
          </label>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            disabled={bulkMutation.isPending || selectedOrderIds.length === 0}
            onClick={() => bulkMutation.mutate()}
          >
            Выполнить
          </button>
          <span className="text-xs text-muted-foreground">Выбрано заказов: {selectedOrderIds.length}</span>
        </div>

        {bulkResult ? (
          <div className="mt-3 rounded-md border p-3 text-xs">
            {bulkResult.dryRun ? (
              <p>Проверка: можно обновить {bulkResult.eligibleCount}, отклонено {bulkResult.rejectedCount}.</p>
            ) : (
              <p>Выполнено: обновлено {bulkResult.updatedCount}, отклонено {bulkResult.rejectedCount}.</p>
            )}
            {bulkResult.rejected.length > 0 ? (
              <div className="mt-2 space-y-1">
                {bulkResult.rejected.slice(0, 10).map((item) => (
                  <p key={item.orderId}>
                    {item.orderId}: {item.reason}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {infoMessage ? <p className="text-sm text-primary">{infoMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {ordersQuery.isLoading ? <p className="text-sm text-muted-foreground">Загружаем заказы...</p> : null}
      {ordersQuery.isError ? <p className="text-sm text-destructive">Не удалось загрузить заказы.</p> : null}

      {ordersQuery.data ? (
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
                      aria-label="Выбрать все загруженные"
                    />
                  </th>
                  <th className="p-3">Заказ</th>
                  <th className="p-3">Покупатель</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Позиции</th>
                  <th className="p-3">Сумма</th>
                  <th className="p-3">Создан</th>
                  <th className="p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {ordersQuery.data.items.map((order) => (
                  <tr key={order.id} className="border-t">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        aria-label={`Выбрать заказ ${order.id}`}
                      />
                    </td>
                    <td className="p-3 font-medium">{order.id}</td>
                    <td className="p-3">{order.user.email}</td>
                    <td className="p-3">{getOrderStatusLabel(order.status)}</td>
                    <td className="p-3">{order._count.items}</td>
                    <td className="p-3">{formatUsdCents(order.totalCents)}</td>
                    <td className="p-3">{formatDateTime(order.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          Подробнее
                        </button>
                        {nextTransitions[order.status].map((nextStatus) => (
                          <button
                            key={nextStatus}
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-40"
                            disabled={updateOrderStatusMutation.isPending}
                            onClick={() =>
                              updateOrderStatusMutation.mutate({
                                orderId: order.id,
                                status: nextStatus
                              })
                            }
                          >
                            {getOrderStatusLabel(nextStatus)}
                          </button>
                        ))}
                        {nextTransitions[order.status].length === 0 ? (
                          <span className="text-xs text-muted-foreground">Нет доступных переходов</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Страница {ordersQuery.data.page} из {ordersQuery.data.totalPages} ({ordersQuery.data.total} заказов)
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={ordersQuery.data.page <= 1}
                type="button"
              >
                Назад
              </button>
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.min(ordersQuery.data.totalPages, current + 1))}
                disabled={ordersQuery.data.page >= ordersQuery.data.totalPages}
                type="button"
              >
                Вперед
              </button>
            </div>
          </div>
        </>
      ) : null}

      {selectedOrderId ? (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Детали заказа</h3>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs"
              onClick={() => setSelectedOrderId(null)}
            >
              Закрыть
            </button>
          </div>

          {detailsQuery.isLoading ? <p className="text-sm text-muted-foreground">Загружаем детали заказа...</p> : null}
          {detailsQuery.isError ? <p className="text-sm text-destructive">Не удалось загрузить детали заказа.</p> : null}

          {detailsQuery.data ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">ID заказа</p>
                  <p className="font-medium">{detailsQuery.data.id}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Покупатель</p>
                  <p className="font-medium">{detailsQuery.data.user.email}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Статус</p>
                  <p className="font-medium">{getOrderStatusLabel(detailsQuery.data.status)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Checkout ID</p>
                  <p className="font-medium">{detailsQuery.data.stripeCheckoutId ?? "Нет"}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="font-medium">{formatUsdCents(detailsQuery.data.subtotalCents)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Shipping</p>
                  <p className="font-medium">{formatUsdCents(detailsQuery.data.shippingCents)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Tax</p>
                  <p className="font-medium">{formatUsdCents(detailsQuery.data.taxCents)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Discount</p>
                  <p className="font-medium">-{formatUsdCents(detailsQuery.data.discountCents)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold">{formatUsdCents(detailsQuery.data.totalCents)}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-medium">Позиции заказа</h4>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="p-2">Бренд</th>
                        <th className="p-2">Товар</th>
                        <th className="p-2">Вариант</th>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Кол-во</th>
                        <th className="p-2">Цена</th>
                        <th className="p-2">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsQuery.data.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2">{item.product.brand}</td>
                          <td className="p-2">{item.product.name}</td>
                          <td className="p-2">
                            {item.variant.name} / {item.variant.color} / {item.variant.size}
                          </td>
                          <td className="p-2">{item.variant.sku}</td>
                          <td className="p-2">{item.quantity}</td>
                          <td className="p-2">{formatUsdCents(item.unitPriceCents)}</td>
                          <td className="p-2">{formatUsdCents(item.totalPriceCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 font-medium">Shipping address</h4>
                  <pre className="overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                    {formatAddressJson(detailsQuery.data.shippingAddressJson)}
                  </pre>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Billing address</h4>
                  <pre className="overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                    {formatAddressJson(detailsQuery.data.billingAddressJson)}
                  </pre>
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-medium">Платежи</h4>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Provider</th>
                        <th className="p-2">Статус</th>
                        <th className="p-2">Сумма</th>
                        <th className="p-2">PaymentIntent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsQuery.data.payments.map((payment) => (
                        <tr key={payment.id} className="border-t">
                          <td className="p-2">{payment.id}</td>
                          <td className="p-2">{payment.provider}</td>
                          <td className="p-2">{payment.status}</td>
                          <td className="p-2">{formatUsdCents(payment.amountCents)}</td>
                          <td className="p-2">{payment.stripePaymentIntentId ?? "Нет"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-medium">Timeline статусов</h4>
                {detailsQuery.data.statusTimeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Изменений статуса пока нет.</p>
                ) : (
                  <div className="space-y-2">
                    {detailsQuery.data.statusTimeline.map((entry) => (
                      <div key={entry.id} className="rounded-md border p-2 text-xs">
                        <p className="font-medium">
                          {entry.fromStatus ?? "N/A"} → {entry.toStatus ?? "N/A"}
                        </p>
                        <p className="text-muted-foreground">
                          {entry.adminEmail} • {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
};
