"use client";

import { useQuery } from "@tanstack/react-query";
import { formatStoreMoney } from "@/lib/currency";
import { getOrderStatusLabel } from "@/lib/order-formatters";

type OrderStatusPayload = {
  id: string;
  status: "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
  totalCents: number;
  currency: string;
  createdAt: string;
};

const isTerminalStatus = (status: OrderStatusPayload["status"]): boolean =>
  status === "PAID" || status === "FULFILLED" || status === "CANCELLED" || status === "REFUNDED";

const formatOrderNumber = (id: string): string => id.slice(-8).toUpperCase();

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

const getStatusClass = (status: OrderStatusPayload["status"]): string => {
  switch (status) {
    case "PAID":
    case "FULFILLED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    case "PENDING":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700";
    case "CANCELLED":
    case "REFUNDED":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
};

export const OrderStatusPoll = ({ orderId, initial }: { orderId: string; initial: OrderStatusPayload }): JSX.Element => {
  const query = useQuery({
    queryKey: ["order-status", orderId],
    queryFn: async (): Promise<OrderStatusPayload> => {
      const response = await fetch(`/api/profile/orders/${orderId}/status`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Не удалось обновить статус заказа");
      }

      const payload = (await response.json()) as { success: boolean; data: OrderStatusPayload };
      return payload.data;
    },
    initialData: initial,
    refetchInterval: (queryState) => {
      const data = queryState.state.data;
      if (!data || isTerminalStatus(data.status)) {
        return false;
      }
      return 5000;
    }
  });

  const order = query.data;

  return (
    <article className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Номер заказа</p>
          <p className="mt-1 text-2xl font-semibold">№{formatOrderNumber(order.id)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Создан: {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-sm font-medium ${getStatusClass(order.status)}`}>
          {getOrderStatusLabel(order.status)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Сумма</p>
          <p className="mt-1 text-lg font-semibold">{formatStoreMoney(order.totalCents, order.currency)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Синхронизация</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isTerminalStatus(order.status) ? "Статус зафиксирован" : "Обновляем статус автоматически"}
          </p>
        </div>
      </div>

      {!isTerminalStatus(order.status) ? (
        <p className="mt-3 text-xs text-muted-foreground">Можно не обновлять страницу: статус подтянется сам.</p>
      ) : null}
      {query.isError ? <p className="mt-3 text-xs text-destructive">Не удалось обновить статус автоматически.</p> : null}
    </article>
  );
};
