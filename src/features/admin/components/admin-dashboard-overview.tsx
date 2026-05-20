"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

type DashboardOverviewPayload = {
  generatedAt: string;
  kpis: {
    totalUsers: number;
    blockedUsers: number;
    totalProducts: number;
    activeProducts: number;
    archivedProducts: number;
    totalOrders: number;
    pendingOrders: number;
    paidOrders: number;
    fulfilledOrders: number;
    totalPosts: number;
    publishedPosts: number;
    activeSessions: number;
    pendingWebhookEvents: number;
    webhooksReceived24h: number;
    webhooksProcessed24h: number;
    webhookDuplicates24h: number;
    webhookFailed24h: number;
  };
  webhookRuntime: {
    windowHours: number;
    generatedAt: string;
    counters: {
      received: number;
      processed: number;
      duplicate: number;
      failed: number;
      replayed: number;
    };
    avgProcessDurationMs: number;
    lastProcessedAt: string | null;
  };
  health: {
    hasOrderBacklog: boolean;
    hasWebhookBacklog: boolean;
    hasWebhookProcessingStall: boolean;
    hasWebhookErrorSpike: boolean;
    hasBlockedUsersSpike: boolean;
  };
  webhookHealth: {
    staleWebhookEvents: number;
    oldestUnprocessedAgeMinutes: number;
  };
};

const statusChipClass = (isAlert: boolean): string =>
  isAlert
    ? "rounded-full border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs text-destructive"
    : "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600";

export const AdminDashboardOverview = (): JSX.Element => {
  const overviewQuery = useQuery({
    queryKey: ["admin-dashboard-overview"],
    queryFn: async (): Promise<DashboardOverviewPayload> => {
      const response = await fetch("/api/admin/dashboard/overview", {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Не удалось загрузить overview дашборда");
      }

      const payload = (await response.json()) as { success: boolean; data: DashboardOverviewPayload };
      return payload.data;
    }
  });

  if (overviewQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Загружаем overview дашборда...</p>;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return <p className="text-sm text-destructive">Не удалось загрузить overview дашборда.</p>;
  }

  const data = overviewQuery.data;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Операционный обзор</h2>
        <p className="text-xs text-muted-foreground">
          Обновлено: {new Date(data.generatedAt).toLocaleString("ru-RU")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Пользователи</p>
          <p className="mt-1 text-2xl font-semibold">{data.kpis.totalUsers}</p>
          <p className="mt-1 text-xs text-muted-foreground">Заблокировано: {data.kpis.blockedUsers}</p>
          <Link className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline" href="/admin/users">
            Открыть пользователей
          </Link>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Товары</p>
          <p className="mt-1 text-2xl font-semibold">{data.kpis.totalProducts}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Активные: {data.kpis.activeProducts} • Архив: {data.kpis.archivedProducts}
          </p>
          <Link className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline" href="/admin/products">
            Открыть товары
          </Link>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Заказы</p>
          <p className="mt-1 text-2xl font-semibold">{data.kpis.totalOrders}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pending: {data.kpis.pendingOrders} • Paid: {data.kpis.paidOrders} • Fulfilled: {data.kpis.fulfilledOrders}
          </p>
          <Link className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline" href="/admin/orders?status=PENDING">
            Открыть backlog заказов
          </Link>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Webhooks Stripe</p>
          <p className="mt-1 text-2xl font-semibold">{data.kpis.pendingWebhookEvents}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            24ч: recv {data.kpis.webhooksReceived24h} • ok {data.kpis.webhooksProcessed24h}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            dup {data.kpis.webhookDuplicates24h} • fail {data.kpis.webhookFailed24h}
          </p>
          <Link className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline" href="/admin/webhooks">
            Открыть webhooks
          </Link>
        </article>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Контент и сессии</p>
          <p className="mt-1 text-2xl font-semibold">{data.kpis.totalPosts}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Опубликовано: {data.kpis.publishedPosts} • Активные сессии: {data.kpis.activeSessions}
          </p>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Webhook runtime</p>
          <p className="mt-1 text-2xl font-semibold">{data.webhookRuntime.avgProcessDurationMs} ms</p>
          <p className="mt-1 text-xs text-muted-foreground">
            last: {data.webhookRuntime.lastProcessedAt ? new Date(data.webhookRuntime.lastProcessedAt).toLocaleString("ru-RU") : "n/a"}
          </p>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Webhook backlog age</p>
          <p className="mt-1 text-2xl font-semibold">{data.webhookHealth.oldestUnprocessedAgeMinutes} мин</p>
          <p className="mt-1 text-xs text-muted-foreground">
            stale ({">"}10 мин): {data.webhookHealth.staleWebhookEvents}
          </p>
        </article>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Health checks</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={statusChipClass(data.health.hasOrderBacklog)}>
            {data.health.hasOrderBacklog ? "Backlog заказов: внимание" : "Backlog заказов: ок"}
          </span>
          <span className={statusChipClass(data.health.hasWebhookBacklog)}>
            {data.health.hasWebhookBacklog ? "Backlog webhooks: внимание" : "Backlog webhooks: ок"}
          </span>
          <span className={statusChipClass(data.health.hasWebhookProcessingStall)}>
            {data.health.hasWebhookProcessingStall ? "Webhook processing stall: внимание" : "Webhook processing stall: ок"}
          </span>
          <span className={statusChipClass(data.health.hasWebhookErrorSpike)}>
            {data.health.hasWebhookErrorSpike ? "Webhook fail spike: внимание" : "Webhook fail spike: ок"}
          </span>
          <span className={statusChipClass(data.health.hasBlockedUsersSpike)}>
            {data.health.hasBlockedUsersSpike ? "Рост блокировок: внимание" : "Рост блокировок: ок"}
          </span>
          <Link
            className="rounded-full border px-2 py-1 text-xs hover:border-primary hover:text-primary"
            href="/admin/webhooks?processed=false"
          >
            Перейти к webhooks
          </Link>
          <Link
            className="rounded-full border px-2 py-1 text-xs hover:border-primary hover:text-primary"
            href="/admin/sessions?status=ACTIVE"
          >
            Перейти к сессиям
          </Link>
        </div>
      </div>
    </section>
  );
};

