import Link from "next/link";
import { requireAuth } from "@/server/utils/require-auth";
import { orderService } from "@/server/services/order-service";
import { OrderStatusPoll } from "@/features/checkout/components/order-status-poll";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const user = await requireAuth();
  const orderId = typeof searchParams.order_id === "string" ? searchParams.order_id : undefined;

  const initialOrderRaw = orderId
    ? await orderService
        .getUserOrderStatus(user.id, orderId)
        .catch(() => null)
    : null;
  const initialOrder = initialOrderRaw
    ? {
        ...initialOrderRaw,
        createdAt: new Date(initialOrderRaw.createdAt).toISOString()
      }
    : null;

  let fallback: {
    id: string;
    status: "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
    totalCents: number;
    currency: string;
    createdAt: string;
  } | null = null;

  if (!initialOrder) {
    const fallbackOrders = await orderService.listForUserPaginated({
      userId: user.id,
      page: 1,
      pageSize: 1
    });
    const first = fallbackOrders.items[0];
    if (first) {
      fallback = {
        id: first.id,
        status: first.status,
        totalCents: first.totalCents,
        currency: first.currency,
        createdAt: first.createdAt.toISOString()
      };
    }
  }

  const order = initialOrder ?? fallback;

  return (
    <section className="mx-auto max-w-2xl space-y-6 rounded-xl border bg-card p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Checkout</p>
        <h1 className="mt-2 text-3xl font-semibold">Заказ принят</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Спасибо за покупку. Мы получили ваш заказ и обновляем статус оплаты автоматически.
        </p>
      </div>

      {order ? (
        <OrderStatusPoll orderId={order.id} initial={order} />
      ) : (
        <p className="text-sm text-muted-foreground">Новый заказ появится в профиле сразу после синхронизации.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/profile" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Перейти в профиль
        </Link>
        <Link href="/catalog" className="rounded-md border px-4 py-2">
          Вернуться в каталог
        </Link>
      </div>
    </section>
  );
}
