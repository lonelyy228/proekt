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
    <article className="rounded-lg border p-4">
      <p className="font-medium">Заказ №{formatOrderNumber(order.id)}</p>
      <p className="text-sm text-muted-foreground">Статус: {getOrderStatusLabel(order.status)}</p>
      <p className="text-sm">Сумма: {formatStoreMoney(order.totalCents, order.currency)}</p>
      {!isTerminalStatus(order.status) ? <p className="mt-2 text-xs text-muted-foreground">Обновляем статус автоматически...</p> : null}
      {query.isError ? <p className="mt-2 text-xs text-destructive">Не удалось обновить статус автоматически.</p> : null}
    </article>
  );
};
