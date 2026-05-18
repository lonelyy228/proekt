import Link from "next/link";

export default function CheckoutCancelPage(): JSX.Element {
  return (
    <section className="mx-auto max-w-2xl space-y-6 rounded-xl border bg-card p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Checkout</p>
        <h1 className="mt-2 text-3xl font-semibold">Оплата отменена</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Оплата не была завершена. Содержимое корзины сохранено, вы можете вернуться и попробовать снова.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/cart" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Вернуться в корзину
        </Link>
        <Link href="/catalog" className="rounded-md border px-4 py-2">
          Перейти в каталог
        </Link>
      </div>
    </section>
  );
}
