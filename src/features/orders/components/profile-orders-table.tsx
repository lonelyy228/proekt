"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatStoreMoney } from "@/lib/currency";
import { getOrderStatusLabel } from "@/lib/order-formatters";

type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";

type OrderItem = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  createdAt: string;
};

type OrdersPayload = {
  items: OrderItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type OrderStatusFilter = "" | OrderStatus;

const ORDER_STATUS_FILTERS: Array<{
  label: string;
  value: OrderStatusFilter;
}> = [
  { label: "Все заказы", value: "" },
  { label: "Ожидает оплаты", value: "PENDING" },
  { label: "Оплачен", value: "PAID" },
  { label: "Выполнен", value: "FULFILLED" },
  { label: "Отменён", value: "CANCELLED" },
  { label: "Возврат", value: "REFUNDED" }
];

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800",
  PAID: "border-emerald-300 bg-emerald-50 text-emerald-800",
  FULFILLED: "border-neutral-300 bg-neutral-100 text-neutral-900",
  CANCELLED: "border-red-300 bg-red-50 text-red-700",
  REFUNDED: "border-blue-300 bg-blue-50 text-blue-700"
};

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

const formatOrderNumber = (id: string): string => id.slice(-8).toUpperCase();

const getEmptyStateCopy = (status: OrderStatusFilter): string => {
  if (!status) {
    return "У вас пока нет заказов. Добавьте товар в корзину или соберите базовую вещь в 2D Lab.";
  }

  return `Заказов со статусом «${getOrderStatusLabel(status)}» пока нет.`;
};

export const ProfileOrdersTable = (): JSX.Element => {
  const [page, setPage] = useState<number>(1);
  const [status, setStatus] = useState<OrderStatusFilter>("");
  const pageSize = 10;

  const queryKey = useMemo(() => ["profile-orders", page, status], [page, status]);

  const ordersQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<OrdersPayload> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });

      if (status) {
        params.set("status", status);
      }

      const response = await fetch(`/api/profile/orders?${params.toString()}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить историю заказов");
      }

      const payload = (await response.json()) as { success: boolean; data: OrdersPayload };
      return payload.data;
    }
  });

  const hasOrders = Boolean(ordersQuery.data && ordersQuery.data.items.length > 0);

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">RSH Account</p>
          <h2 className="mt-1 text-2xl font-semibold">История заказов</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Здесь отображаются покупки из каталога и кастомные заказы из RSH 2D Lab. Статус обновляется после оплаты и обработки заказа.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Статус</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as OrderStatusFilter);
                setPage(1);
              }}
              className="rounded-md border bg-background px-3 py-2"
            >
              {ORDER_STATUS_FILTERS.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => ordersQuery.refetch()}
            className="rounded-md border px-3 py-2 text-sm transition hover:bg-muted disabled:opacity-50"
            disabled={ordersQuery.isFetching}
          >
            {ordersQuery.isFetching ? "Обновляем..." : "Обновить"}
          </button>
        </div>
      </div>

      {ordersQuery.isLoading ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Загружаем заказы...</div>
      ) : null}

      {ordersQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить заказы. Проверьте подключение и попробуйте обновить список.
        </div>
      ) : null}

      {hasOrders ? (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="p-4">Заказ</th>
                  <th className="p-4">Дата</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {ordersQuery.data?.items.map((order) => (
                  <tr key={order.id} className="border-t transition hover:bg-muted/30">
                    <td className="p-4 font-medium">#{formatOrderNumber(order.id)}</td>
                    <td className="p-4 text-muted-foreground">{formatDate(order.createdAt)}</td>
                    <td className="p-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[order.status]}`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium">{formatStoreMoney(order.totalCents, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              Страница {ordersQuery.data?.page ?? 1} из {ordersQuery.data?.totalPages ?? 1}. Всего заказов: {ordersQuery.data?.total ?? 0}.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 transition hover:bg-muted disabled:opacity-40"
                disabled={(ordersQuery.data?.page ?? 1) <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Назад
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 transition hover:bg-muted disabled:opacity-40"
                disabled={(ordersQuery.data?.page ?? 1) >= (ordersQuery.data?.totalPages ?? 1)}
                onClick={() => setPage((current) => Math.min(ordersQuery.data?.totalPages ?? current, current + 1))}
              >
                Вперёд
              </button>
            </div>
          </div>
        </>
      ) : null}

      {ordersQuery.data && ordersQuery.data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6">
          <p className="text-sm text-muted-foreground">{getEmptyStateCopy(status)}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/catalog" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Перейти в каталог
            </Link>
            <Link href="/editor" className="rounded-md border px-4 py-2 text-sm">
              Открыть 2D Lab
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
};
