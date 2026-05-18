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

export const OrderStatusPoll = ({ orderId, initial }: { orderId: string; initial: OrderStatusPayload }): JSX.Element => {
    const query = useQuery({
    queryKey: ["order-status", orderId],
    queryFn: async (): Promise<OrderStatusPayload> => {
      const response = await fetch(`/api/profile/orders/${orderId}/status`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ Р·Р°РєР°Р·Р°");
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
      <p className="font-medium">Р—Р°РєР°Р· в„–{order.id}</p>
      <p className="text-sm text-muted-foreground">РЎС‚Р°С‚СѓСЃ: {getOrderStatusLabel(order.status)}</p>
      <p className="text-sm">РЎСѓРјРјР°: {formatStoreMoney(order.totalCents, order.currency )}</p>
      {!isTerminalStatus(order.status) ? (
        <p className="mt-2 text-xs text-muted-foreground">
          РћР±РЅРѕРІР»СЏРµРј СЃС‚Р°С‚СѓСЃ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё...
        </p>
      ) : null}
      {query.isError ? <p className="mt-2 text-xs text-destructive">РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.</p> : null}
    </article>
  );
};

