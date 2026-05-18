"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

type PeriodDays = 7 | 14 | 30 | 90;

type MetricSnapshot = {
  current: number;
  previous: number;
  deltaPercent: number;
};

type AnalyticsPayload = {
  period: {
    days: PeriodDays;
    startDate: string;
    endDateExclusive: string;
  };
  metrics: {
    totalOrders: MetricSnapshot;
    paidOrders: MetricSnapshot;
    revenueCents: MetricSnapshot;
    aovCents: MetricSnapshot;
    paidRatePercent: MetricSnapshot;
    newUsers: MetricSnapshot;
  };
  daily: Array<{
    date: string;
    ordersCount: number;
    paidOrdersCount: number;
    revenueCents: number;
  }>;
};

const periodLabelMap: Record<PeriodDays, string> = {
  7: "7 дней",
  14: "14 дней",
  30: "30 дней",
  90: "90 дней"
};

const toPeriodDays = (value: string): PeriodDays => {
  switch (value) {
    case "7":
      return 7;
    case "14":
      return 14;
    case "90":
      return 90;
    case "30":
    default:
      return 30;
  }
};

const formatUsdCents = (value: number): string => `$${(value / 100).toFixed(2)}`;

const formatDelta = (value: number): string => {
  if (value === 0) {
    return "0%";
  }
  return value > 0 ? `+${value}%` : `${value}%`;
};

const deltaClassName = (value: number): string => {
  if (value > 0) {
    return "text-emerald-500";
  }
  if (value < 0) {
    return "text-destructive";
  }
  return "text-muted-foreground";
};

export const AdminDashboardAnalytics = (): JSX.Element => {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics", periodDays],
    queryFn: async (): Promise<AnalyticsPayload> => {
      const response = await fetch(`/api/admin/analytics?periodDays=${periodDays}`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Не удалось загрузить аналитику");
      }

      const payload = (await response.json()) as { success: boolean; data: AnalyticsPayload };
      return payload.data;
    }
  });

  const maxRevenueCents = useMemo(() => {
    if (!analyticsQuery.data || analyticsQuery.data.daily.length === 0) {
      return 0;
    }

    return Math.max(...analyticsQuery.data.daily.map((item) => item.revenueCents));
  }, [analyticsQuery.data]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Аналитика</h2>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={periodDays}
            onChange={(event) => setPeriodDays(toPeriodDays(event.target.value))}
          >
            <option value={7}>{periodLabelMap[7]}</option>
            <option value={14}>{periodLabelMap[14]}</option>
            <option value={30}>{periodLabelMap[30]}</option>
            <option value={90}>{periodLabelMap[90]}</option>
          </select>
          <Link className="rounded-md border px-3 py-2 text-xs hover:border-primary hover:text-primary" href="/admin/orders">
            Drill-down в заказы
          </Link>
        </div>
      </div>

      {analyticsQuery.isLoading ? <p className="text-sm text-muted-foreground">Загружаем аналитику...</p> : null}
      {analyticsQuery.isError ? <p className="text-sm text-destructive">Ошибка загрузки аналитики.</p> : null}

      {analyticsQuery.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Заказы</p>
              <p className="mt-1 text-2xl font-semibold">{analyticsQuery.data.metrics.totalOrders.current}</p>
              <p className={`mt-1 text-xs ${deltaClassName(analyticsQuery.data.metrics.totalOrders.deltaPercent)}`}>
                {formatDelta(analyticsQuery.data.metrics.totalOrders.deltaPercent)} к прошлому периоду
              </p>
            </article>

            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Оплаченные заказы</p>
              <p className="mt-1 text-2xl font-semibold">{analyticsQuery.data.metrics.paidOrders.current}</p>
              <p className={`mt-1 text-xs ${deltaClassName(analyticsQuery.data.metrics.paidOrders.deltaPercent)}`}>
                {formatDelta(analyticsQuery.data.metrics.paidOrders.deltaPercent)} к прошлому периоду
              </p>
            </article>

            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Выручка</p>
              <p className="mt-1 text-2xl font-semibold">{formatUsdCents(analyticsQuery.data.metrics.revenueCents.current)}</p>
              <p className={`mt-1 text-xs ${deltaClassName(analyticsQuery.data.metrics.revenueCents.deltaPercent)}`}>
                {formatDelta(analyticsQuery.data.metrics.revenueCents.deltaPercent)} к прошлому периоду
              </p>
            </article>

            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">AOV</p>
              <p className="mt-1 text-2xl font-semibold">{formatUsdCents(analyticsQuery.data.metrics.aovCents.current)}</p>
              <p className={`mt-1 text-xs ${deltaClassName(analyticsQuery.data.metrics.aovCents.deltaPercent)}`}>
                {formatDelta(analyticsQuery.data.metrics.aovCents.deltaPercent)} к прошлому периоду
              </p>
            </article>

            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Paid Rate</p>
              <p className="mt-1 text-2xl font-semibold">{analyticsQuery.data.metrics.paidRatePercent.current}%</p>
              <p className={`mt-1 text-xs ${deltaClassName(analyticsQuery.data.metrics.paidRatePercent.deltaPercent)}`}>
                {formatDelta(analyticsQuery.data.metrics.paidRatePercent.deltaPercent)} к прошлому периоду
              </p>
            </article>

            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Новые пользователи</p>
              <p className="mt-1 text-2xl font-semibold">{analyticsQuery.data.metrics.newUsers.current}</p>
              <p className={`mt-1 text-xs ${deltaClassName(analyticsQuery.data.metrics.newUsers.deltaPercent)}`}>
                {formatDelta(analyticsQuery.data.metrics.newUsers.deltaPercent)} к прошлому периоду
              </p>
            </article>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium">Дневная выручка</h3>
            <div className="mt-4 space-y-2">
              {analyticsQuery.data.daily.map((day) => {
                const widthPercent =
                  maxRevenueCents > 0 ? Math.max(3, Math.round((day.revenueCents / maxRevenueCents) * 100)) : 3;

                return (
                  <div key={day.date} className="grid grid-cols-[100px_1fr_120px] items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{day.date}</span>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-[width]"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <span className="text-right font-medium">{formatUsdCents(day.revenueCents)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
};
