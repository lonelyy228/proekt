"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { useDebouncedValue } from "@/features/admin/hooks/use-debounced-value";
import { buildQueryString, countActiveFilters, toTrimmedOrUndefined } from "@/features/admin/lib/admin-table-utils";
import { AdminSavedViewsPanel } from "@/features/admin/components/admin-saved-views-panel";
import { buildExportFileName, downloadCsvFile } from "@/features/admin/lib/file-download";

type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type ProductSortBy = "newest" | "price_asc" | "price_desc" | "name_asc";

type AdminCategory = {
  id: string;
  name: string;
  slug: string;
};

type AdminProductItem = {
  id: string;
  brand: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  status: ProductStatus;
  categoryId: string;
  basePriceCents: number;
  currency: string;
  tags: string[];
  createdAt: string;
  category: {
    id: string;
    name: string;
  };
};

type PaginatedProducts = {
  items: AdminProductItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ProductFormState = {
  brand: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  basePriceCents: number;
  currency: "USD";
  tagsText: string;
  status: ProductStatus;
};

type ProductPresetFiltersPayload = {
  search?: string;
  brand?: string;
  categoryId?: string;
  status?: ProductStatus;
  sortBy?: ProductSortBy;
};

type AdminProductFilterPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  filters: ProductPresetFiltersPayload;
};

type BulkEligibleItem = {
  productId: string;
  fromStatus: ProductStatus;
  toStatus: ProductStatus;
  reason?: string | null;
};

type BulkRejectedItem = {
  productId: string;
  reason: string;
};

type BulkDryRunResult = {
  dryRun: true;
  requestedCount: number;
  eligibleCount: number;
  rejectedCount: number;
  eligible: BulkEligibleItem[];
  rejected: BulkRejectedItem[];
};

type BulkApplyResult = {
  dryRun: false;
  requestedCount: number;
  updatedCount: number;
  rejectedCount: number;
  updatedProductIds: string[];
  rejected: BulkRejectedItem[];
};

const PAGE_SIZE = 20;

const initialCreateForm: ProductFormState = {
  brand: "",
  name: "",
  slug: "",
  description: "",
  shortDescription: "",
  categoryId: "",
  basePriceCents: 0,
  currency: "USD",
  tagsText: "",
  status: "ACTIVE"
};

const parseTags = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const formatUsdCents = (value: number): string => `$${(value / 100).toFixed(2)}`;

const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

const buildFormFromProduct = (item: AdminProductItem): ProductFormState => ({
  brand: item.brand,
  name: item.name,
  slug: item.slug,
  description: item.description,
  shortDescription: item.shortDescription ?? "",
  categoryId: item.categoryId,
  basePriceCents: item.basePriceCents,
  currency: "USD",
  tagsText: item.tags.join(", "),
  status: item.status
});

export const AdminProductsManager = (): JSX.Element => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitFromUrlRef = useRef<boolean>(false);
  const lastSerializedFiltersRef = useRef<string>("");
  const didAutoApplyDefaultPresetRef = useRef<boolean>(false);

  const [page, setPage] = useState<number>(1);
  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [brand, setBrand] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [sortBy, setSortBy] = useState<ProductSortBy>("newest");

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProductStatus>("ARCHIVED");
  const [bulkDryRun, setBulkDryRun] = useState<boolean>(true);
  const [bulkResult, setBulkResult] = useState<BulkDryRunResult | BulkApplyResult | null>(null);

  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [presetName, setPresetName] = useState<string>("");
  const [presetAsDefault, setPresetAsDefault] = useState<boolean>(false);

  const [createForm, setCreateForm] = useState<ProductFormState>(initialCreateForm);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductFormState | null>(null);

  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied" | "error">("idle");
  const [exportState, setExportState] = useState<"idle" | "loading" | "error">("idle");
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (didInitFromUrlRef.current) {
      return;
    }

    const nextPageRaw = Number(searchParams.get("page") ?? "1");
    const nextPage = Number.isFinite(nextPageRaw) && nextPageRaw > 0 ? Math.floor(nextPageRaw) : 1;
    const nextSearch = searchParams.get("search") ?? "";
    const nextBrand = searchParams.get("brand") ?? "";
    const nextCategoryId = searchParams.get("categoryId") ?? "";
    const nextStatusRaw = searchParams.get("status");
    const nextStatus =
      nextStatusRaw === "DRAFT" || nextStatusRaw === "ACTIVE" || nextStatusRaw === "ARCHIVED"
        ? nextStatusRaw
        : "";
    const nextSortByRaw = searchParams.get("sortBy");
    const nextSortBy: ProductSortBy =
      nextSortByRaw === "newest" ||
      nextSortByRaw === "price_asc" ||
      nextSortByRaw === "price_desc" ||
      nextSortByRaw === "name_asc"
        ? nextSortByRaw
        : "newest";
    const nextView = searchParams.get("view") ?? "";

    setPage(nextPage);
    setSearchInput(nextSearch);
    setBrand(nextBrand);
    setCategoryId(nextCategoryId);
    setStatus(nextStatus);
    setSortBy(nextSortBy);
    setSelectedPresetId(nextView);

    lastSerializedFiltersRef.current = searchParams.toString();
    didInitFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!didInitFromUrlRef.current) {
      return;
    }
    setPage(1);
  }, [debouncedSearch, brand, categoryId, status, sortBy]);

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
    if (brand.trim()) {
      params.set("brand", brand.trim());
    }
    if (categoryId) {
      params.set("categoryId", categoryId);
    }
    if (status) {
      params.set("status", status);
    }
    if (sortBy !== "newest") {
      params.set("sortBy", sortBy);
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
  }, [brand, categoryId, debouncedSearch, page, pathname, router, selectedPresetId, sortBy, status]);

  const categoriesQuery = useQuery({
    queryKey: ["admin-product-categories"],
    queryFn: async (): Promise<AdminCategory[]> => {
      const response = await fetch("/api/admin/products/categories", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить категории");
      }
      const payload = (await response.json()) as { success: boolean; data: AdminCategory[] };
      return payload.data;
    }
  });

  const productsQueryKey = useMemo(
    () => ["admin-products", page, debouncedSearch, brand, categoryId, status, sortBy],
    [brand, categoryId, debouncedSearch, page, sortBy, status]
  );

  const productsQuery = useQuery({
    queryKey: productsQueryKey,
    queryFn: async (): Promise<PaginatedProducts> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy
      });
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (brand.trim()) {
        params.set("brand", brand.trim());
      }
      if (categoryId) {
        params.set("categoryId", categoryId);
      }
      if (status) {
        params.set("status", status);
      }

      const response = await fetch(`/api/admin/products?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить товары");
      }
      const payload = (await response.json()) as { success: boolean; data: PaginatedProducts };
      return payload.data;
    }
  });

  const presetsQuery = useQuery({
    queryKey: ["admin-product-filter-presets"],
    queryFn: async (): Promise<AdminProductFilterPreset[]> => {
      const response = await fetch("/api/admin/products/presets", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить пресеты товаров");
      }
      const payload = (await response.json()) as { success: boolean; data: AdminProductFilterPreset[] };
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

  const currentFiltersPayload = useMemo<ProductPresetFiltersPayload>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      brand: brand.trim() || undefined,
      categoryId: categoryId || undefined,
      status: status || undefined,
      sortBy
    }),
    [brand, categoryId, debouncedSearch, sortBy, status]
  );

  const applyPresetFilters = (filters: ProductPresetFiltersPayload): void => {
    setSearchInput(filters.search ?? "");
    setBrand(filters.brand ?? "");
    setCategoryId(filters.categoryId ?? "");
    setStatus(filters.status ?? "");
    setSortBy(filters.sortBy ?? "newest");
    setPage(1);
    setSelectedProductIds([]);
    setBulkResult(null);
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
      debouncedSearch.trim().length > 0 ||
      brand.trim().length > 0 ||
      Boolean(categoryId) ||
      Boolean(status) ||
      sortBy !== "newest";

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
  }, [brand, categoryId, debouncedSearch, page, presetsQuery.data, selectedPresetId, sortBy, status]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          brand: createForm.brand,
          name: createForm.name,
          slug: createForm.slug,
          description: createForm.description,
          shortDescription: createForm.shortDescription || undefined,
          categoryId: createForm.categoryId,
          basePriceCents: Number(createForm.basePriceCents),
          currency: "USD",
          tags: parseTags(createForm.tagsText)
        })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось создать товар"));
      }
    },
    onSuccess: () => {
      setInfoMessage("Товар создан");
      setErrorMessage("");
      setCreateForm(initialCreateForm);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка создания товара");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { productId: string; form: ProductFormState }) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/products/${encodeURIComponent(payload.productId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          brand: payload.form.brand,
          name: payload.form.name,
          slug: payload.form.slug,
          description: payload.form.description,
          shortDescription: payload.form.shortDescription || null,
          categoryId: payload.form.categoryId,
          basePriceCents: Number(payload.form.basePriceCents),
          currency: "USD",
          status: payload.form.status,
          tags: parseTags(payload.form.tagsText)
        })
      });

      const body = (await response.json()) as {
        success: boolean;
        data?: AdminProductItem;
        error?: { message?: string };
      };

      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error?.message ?? "Не удалось обновить товар");
      }
      return body.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: productsQueryKey });
      const previous = queryClient.getQueryData<PaginatedProducts>(productsQueryKey);

      if (previous) {
        queryClient.setQueryData<PaginatedProducts>(productsQueryKey, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === payload.productId
              ? {
                  ...item,
                  brand: payload.form.brand,
                  name: payload.form.name,
                  slug: payload.form.slug,
                  description: payload.form.description,
                  shortDescription: payload.form.shortDescription || null,
                  categoryId: payload.form.categoryId,
                  basePriceCents: Number(payload.form.basePriceCents),
                  status: payload.form.status,
                  tags: parseTags(payload.form.tagsText)
                }
              : item
          )
        });
      }
      return { previous };
    },
    onError: (error: unknown, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(productsQueryKey, context.previous);
      }
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления товара");
    },
    onSuccess: () => {
      setInfoMessage("Товар обновлен");
      setErrorMessage("");
      setEditProductId(null);
      setEditForm(null);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось удалить товар"));
      }
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: productsQueryKey });
      const previous = queryClient.getQueryData<PaginatedProducts>(productsQueryKey);

      if (previous) {
        queryClient.setQueryData<PaginatedProducts>(productsQueryKey, {
          ...previous,
          items: previous.items.filter((item) => item.id !== productId),
          total: Math.max(0, previous.total - 1)
        });
      }
      return { previous };
    },
    onError: (error: unknown, _productId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(productsQueryKey, context.previous);
      }
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка удаления товара");
    },
    onSuccess: () => {
      setInfoMessage("Товар удален");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    }
  });

  const bulkMutation = useMutation({
    mutationFn: async (): Promise<BulkDryRunResult | BulkApplyResult> => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          productIds: selectedProductIds,
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
        setInfoMessage(`Проверка: подходят ${result.eligibleCount}, отклонены ${result.rejectedCount}`);
      } else {
        setInfoMessage(`Операция применена: обновлено ${result.updatedCount}, отклонены ${result.rejectedCount}`);
        setSelectedProductIds([]);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (error: unknown) => {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка bulk-операции");
    }
  });

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/admin/products/presets", {
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
        data?: AdminProductFilterPreset;
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
      queryClient.invalidateQueries({ queryKey: ["admin-product-filter-presets"] });
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
      const response = await fetch(`/api/admin/products/presets/${encodeURIComponent(selectedPresetId)}`, {
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
        data?: AdminProductFilterPreset;
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
      queryClient.invalidateQueries({ queryKey: ["admin-product-filter-presets"] });
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
      const response = await fetch(`/api/admin/products/presets/${encodeURIComponent(selectedPresetId)}`, {
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
      queryClient.invalidateQueries({ queryKey: ["admin-product-filter-presets"] });
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

  const exportProductsCsv = async (): Promise<void> => {
    try {
      setExportState("loading");
      const query = buildQueryString([
        ["search", toTrimmedOrUndefined(debouncedSearch)],
        ["brand", toTrimmedOrUndefined(brand)],
        ["categoryId", categoryId || undefined],
        ["status", status || undefined],
        ["sortBy", sortBy],
        ["limit", "1000"]
      ]);
      const response = await fetch(`/api/admin/products/export${query ? `?${query}` : ""}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Не удалось выгрузить товары"));
      }

      const csv = await response.text();
      downloadCsvFile(buildExportFileName("admin-products", "csv"), csv);
      setInfoMessage("CSV выгрузка товаров готова");
      setErrorMessage("");
      setExportState("idle");
    } catch (error: unknown) {
      setInfoMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Ошибка выгрузки товаров");
      setExportState("error");
      setTimeout(() => setExportState("idle"), 2000);
    }
  };

  const loadedProductIds = productsQuery.data?.items.map((item) => item.id) ?? [];
  const selectedLoadedIds = loadedProductIds.filter((id) => selectedProductIds.includes(id));
  const allSelectedLoaded = loadedProductIds.length > 0 && selectedLoadedIds.length === loadedProductIds.length;

  const activeFiltersCount = countActiveFilters([
    debouncedSearch.trim().length > 0,
    brand.trim().length > 0,
    Boolean(categoryId),
    Boolean(status),
    sortBy !== "newest"
  ]);

  const toggleProductSelection = (productId: string): void => {
    setSelectedProductIds((current) => {
      if (current.includes(productId)) {
        return current.filter((item) => item !== productId);
      }
      return [...current, productId];
    });
  };

  const toggleSelectLoaded = (): void => {
    if (allSelectedLoaded) {
      setSelectedProductIds((current) => current.filter((id) => !loadedProductIds.includes(id)));
      return;
    }
    setSelectedProductIds((current) => Array.from(new Set([...current, ...loadedProductIds])));
  };

  const canCreateProduct =
    createForm.brand.trim().length > 1 &&
    createForm.name.trim().length > 1 &&
    createForm.slug.trim().length > 1 &&
    createForm.description.trim().length >= 20 &&
    createForm.categoryId.trim().length > 0;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Товары</h2>

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Поиск по имени или slug"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />

          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Фильтр по бренду"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
          />

          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Все категории</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | ProductStatus)}
          >
            <option value="">Все статусы</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as ProductSortBy)}
          >
            <option value="newest">Сначала новые</option>
            <option value="price_asc">Цена по возрастанию</option>
            <option value="price_desc">Цена по убыванию</option>
            <option value="name_asc">Имя A-Z</option>
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
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            onClick={() => {
              void exportProductsCsv();
            }}
            disabled={exportState === "loading"}
          >
            {exportState === "loading" ? "Готовим CSV..." : exportState === "error" ? "Ошибка выгрузки" : "Экспорт CSV"}
          </button>
        </div>

        <div className="mt-2 flex">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary"
            onClick={() => {
              setPage(1);
              setSearchInput("");
              setBrand("");
              setCategoryId("");
              setStatus("");
              setSortBy("newest");
              setSelectedProductIds([]);
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
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Создать товар</h3>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Бренд"
            value={createForm.brand}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, brand: event.target.value }))}
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Название"
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="slug"
            value={createForm.slug}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, slug: event.target.value }))}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={createForm.categoryId}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, categoryId: event.target.value }))}
          >
            <option value="">Категория</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2"
            placeholder="Короткое описание"
            value={createForm.shortDescription}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Теги через запятую"
            value={createForm.tagsText}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, tagsText: event.target.value }))}
          />
          <input
            type="number"
            min={0}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Цена в центах"
            value={createForm.basePriceCents}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                basePriceCents: Math.max(0, Number(event.target.value) || 0)
              }))
            }
          />
          <textarea
            className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2 xl:col-span-4"
            rows={4}
            placeholder="Описание (минимум 20 символов)"
            value={createForm.description}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40 md:col-span-2 xl:col-span-1"
            disabled={!canCreateProduct || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Создать
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Массовая смена статуса</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as ProductStatus)}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={bulkDryRun} onChange={(event) => setBulkDryRun(event.target.checked)} />
            Проверка (dry-run)
          </label>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            disabled={bulkMutation.isPending || selectedProductIds.length === 0}
            onClick={() => bulkMutation.mutate()}
          >
            Выполнить
          </button>
          <span className="text-xs text-muted-foreground">Выбрано товаров: {selectedProductIds.length}</span>
        </div>

        {bulkResult ? (
          <div className="mt-3 rounded-md border p-3 text-xs">
            {bulkResult.dryRun ? (
              <p>Проверка: подходят {bulkResult.eligibleCount}, отклонены {bulkResult.rejectedCount}.</p>
            ) : (
              <p>Выполнено: обновлено {bulkResult.updatedCount}, отклонены {bulkResult.rejectedCount}.</p>
            )}

            {bulkResult.rejected.length > 0 ? (
              <div className="mt-2 space-y-1">
                {bulkResult.rejected.slice(0, 10).map((item) => (
                  <p key={item.productId}>
                    {item.productId}: {item.reason}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {infoMessage ? <p className="text-sm text-primary">{infoMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {productsQuery.isLoading ? <p className="text-sm text-muted-foreground">Загружаем товары...</p> : null}
      {productsQuery.isError ? <p className="text-sm text-destructive">Не удалось загрузить товары.</p> : null}

      {productsQuery.data ? (
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
                      aria-label="Выбрать все товары на странице"
                    />
                  </th>
                  <th className="p-3">Товар</th>
                  <th className="p-3">Бренд</th>
                  <th className="p-3">Категория</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Цена</th>
                  <th className="p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {productsQuery.data.items.map((item) => {
                  const isEditing = editProductId === item.id && editForm !== null;
                  return (
                    <tr key={item.id} className="border-t align-top">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(item.id)}
                          onChange={() => toggleProductSelection(item.id)}
                          aria-label={`Выбрать товар ${item.name}`}
                        />
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              className="w-full rounded-md border bg-background px-2 py-1"
                              value={editForm.name}
                              onChange={(event) =>
                                setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                              }
                            />
                            <input
                              className="w-full rounded-md border bg-background px-2 py-1"
                              value={editForm.slug}
                              onChange={(event) =>
                                setEditForm((prev) => (prev ? { ...prev, slug: event.target.value } : prev))
                              }
                            />
                            <textarea
                              className="w-full rounded-md border bg-background px-2 py-1"
                              rows={3}
                              value={editForm.description}
                              onChange={(event) =>
                                setEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                              }
                            />
                            <input
                              className="w-full rounded-md border bg-background px-2 py-1"
                              value={editForm.shortDescription}
                              onChange={(event) =>
                                setEditForm((prev) => (prev ? { ...prev, shortDescription: event.target.value } : prev))
                              }
                              placeholder="Короткое описание"
                            />
                            <input
                              className="w-full rounded-md border bg-background px-2 py-1"
                              value={editForm.tagsText}
                              onChange={(event) =>
                                setEditForm((prev) => (prev ? { ...prev, tagsText: event.target.value } : prev))
                              }
                              placeholder="Теги через запятую"
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">/{item.slug}</p>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            className="w-full rounded-md border bg-background px-2 py-1"
                            value={editForm.brand}
                            onChange={(event) =>
                              setEditForm((prev) => (prev ? { ...prev, brand: event.target.value } : prev))
                            }
                          />
                        ) : (
                          item.brand
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            className="w-full rounded-md border bg-background px-2 py-1"
                            value={editForm.categoryId}
                            onChange={(event) =>
                              setEditForm((prev) => (prev ? { ...prev, categoryId: event.target.value } : prev))
                            }
                          >
                            {(categoriesQuery.data ?? []).map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.category.name
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            className="w-full rounded-md border bg-background px-2 py-1"
                            value={editForm.status}
                            onChange={(event) =>
                              setEditForm((prev) => (prev ? { ...prev, status: event.target.value as ProductStatus } : prev))
                            }
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="ARCHIVED">ARCHIVED</option>
                          </select>
                        ) : (
                          item.status
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            className="w-28 rounded-md border bg-background px-2 py-1"
                            value={editForm.basePriceCents}
                            onChange={(event) =>
                              setEditForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      basePriceCents: Math.max(0, Number(event.target.value) || 0)
                                    }
                                  : prev
                              )
                            }
                          />
                        ) : (
                          formatUsdCents(item.basePriceCents)
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-40"
                              disabled={updateMutation.isPending}
                              onClick={() => {
                                if (!editProductId || !editForm) {
                                  return;
                                }
                                updateMutation.mutate({ productId: editProductId, form: editForm });
                              }}
                            >
                              Сохранить
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs"
                              onClick={() => {
                                setEditProductId(null);
                                setEditForm(null);
                              }}
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                              onClick={() => {
                                setEditProductId(item.id);
                                setEditForm(buildFormFromProduct(item));
                              }}
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:border-destructive hover:text-destructive disabled:opacity-40"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(item.id)}
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Страница {productsQuery.data.page} из {productsQuery.data.totalPages} ({productsQuery.data.total} товаров)
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={productsQuery.data.page <= 1}
                type="button"
              >
                Назад
              </button>
              <button
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((current) => Math.min(productsQuery.data.totalPages, current + 1))}
                disabled={productsQuery.data.page >= productsQuery.data.totalPages}
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

