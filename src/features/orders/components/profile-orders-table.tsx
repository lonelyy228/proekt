"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatStoreMoney } from "@/lib/currency";
import { getOrderStatusLabel } from "@/lib/order-formatters";

type OrderItem = {
  id: string;
  status: "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
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

const ORDER_STATUS_FILTERS: Array<{
  label: string;
  value: "" | "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
}> = [
  { label: "Р’СЃРµ", value: "" },
  { label: "РћР¶РёРґР°РµС‚ РѕРїР»Р°С‚С‹", value: "PENDING" },
  { label: "РћРїР»Р°С‡РµРЅ", value: "PAID" },
  { label: "Р’С‹РїРѕР»РЅРµРЅ", value: "FULFILLED" },
  { label: "РћС‚РјРµРЅРµРЅ", value: "CANCELLED" },
  { label: "Р’РѕР·РІСЂР°С‚", value: "REFUNDED" }
];

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

export const ProfileOrdersTable = (): JSX.Element => {
    const [page, setPage] = useState<number>(1);
  const [status, setStatus] = useState<"" | "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED">("");
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
        throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёСЃС‚РѕСЂРёСЋ Р·Р°РєР°Р·РѕРІ");
      }

      const payload = (await response.json()) as { success: boolean; data: OrdersPayload };
      return payload.data;
    }
  });

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">РСЃС‚РѕСЂРёСЏ Р·Р°РєР°Р·РѕРІ</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">РЎС‚Р°С‚СѓСЃ</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-md border bg-background px-2 py-1"
          >
            {ORDER_STATUS_FILTERS.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ordersQuery.isLoading ? <p className="text-sm text-muted-foreground">Р—Р°РіСЂСѓР¶Р°РµРј Р·Р°РєР°Р·С‹...</p> : null}
      {ordersQuery.isError ? <p className="text-sm text-destructive">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р·Р°РєР°Р·С‹.</p> : null}

      {ordersQuery.data && ordersQuery.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3">Р—Р°РєР°Р·</th>
                  <th className="p-3">Р”Р°С‚Р°</th>
                  <th className="p-3">РЎС‚Р°С‚СѓСЃ</th>
                  <th className="p-3">РЎСѓРјРјР°</th>
                </tr>
              </thead>
              <tbody>
                {ordersQuery.data.items.map((order) => (
                  <tr key={order.id} className="border-t">
                    <td className="p-3">в„–{order.id}</td>
                    <td className="p-3">{formatDate(order.createdAt)}</td>
                    <td className="p-3">{getOrderStatusLabel(order.status)}</td>
                    <td className="p-3">{formatStoreMoney(order.totalCents, order.currency )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              РЎС‚СЂР°РЅРёС†Р° {ordersQuery.data.page} РёР· {ordersQuery.data.totalPages} ({ordersQuery.data.total} Р·Р°РєР°Р·РѕРІ)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                disabled={ordersQuery.data.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                РќР°Р·Р°Рґ
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1 disabled:opacity-40"
                disabled={ordersQuery.data.page >= ordersQuery.data.totalPages}
                onClick={() =>
                  setPage((current) => Math.min(ordersQuery.data?.totalPages ?? current, current + 1))
                }
              >
                Р’РїРµСЂРµРґ
              </button>
            </div>
          </div>
        </>
      ) : null}

      {ordersQuery.data && ordersQuery.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Р—Р°РєР°Р·РѕРІ СЃ РІС‹Р±СЂР°РЅРЅС‹Рј СЃС‚Р°С‚СѓСЃРѕРј РЅРµ РЅР°Р№РґРµРЅРѕ.</p>
      ) : null}
    </section>
  );
};

