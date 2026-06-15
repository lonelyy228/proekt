import Link from "next/link";

export default function HomePage(): JSX.Element {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 overflow-hidden rounded-2xl border bg-card/90 p-5 shadow-sm sm:gap-8 sm:p-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary">RSH Брендовый Маркет</p>
          <h1
            className="mt-3 max-w-[11ch] text-[2.3rem] leading-[0.9] tracking-[0.04em] sm:max-w-none sm:text-6xl sm:tracking-[0.05em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            СТРОГО. МИНИМАЛЬНО. ПО-БРЕНДОВОМУ.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:mt-5 sm:text-base">
            RSH — нишевый русскоязычный магазин брендовой одежды. Основа каталога — обычные повседневные вещи от Adidas,
            Nike, Puma, Timberland, Maison Margiela, Gucci, Balenciaga, Off-White, Stone Island, New Balance и других
            брендов. 2D Lab доступен только для линейки RSH BASICS.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/catalog" className="rounded-md bg-primary px-4 py-3 text-center text-primary-foreground">
              Перейти в каталог
            </Link>
            <Link href="/catalog/basics" className="rounded-md border px-4 py-3 text-center">
              Basics для кастома
            </Link>
            <Link href="/editor" className="rounded-md border px-4 py-3 text-center">
              Открыть 2D Lab
            </Link>
          </div>
        </div>
        <div className="rounded-xl border bg-[linear-gradient(135deg,rgba(12,12,12,0.12),rgba(255,255,255,0.64))] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Сейчас в фокусе</p>
          <p className="mt-3 text-xl font-semibold sm:text-2xl">Брендовые позиции + RSH Basics</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Повседневные брендовые вещи</li>
            <li>Популярные бренды и стабильные размеры</li>
            <li>Кастомизация только для RSH BASICS</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
