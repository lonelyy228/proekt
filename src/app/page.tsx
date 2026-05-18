import Link from "next/link";

export default function HomePage(): JSX.Element {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 rounded-2xl border bg-card/90 p-10 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary">RSH Брендовый Маркет</p>
          <h1 className="mt-3 text-6xl leading-[0.9] tracking-[0.05em]" style={{ fontFamily: "var(--font-heading)" }}>
            СТРОГО. МИНИМАЛЬНО. ПО-БРЕНДОВОМУ.
          </h1>
          <p className="mt-5 max-w-2xl text-muted-foreground">
            RSH — нишевый русскоязычный магазин брендовой одежды. Основа каталога — обычные повседневные вещи от Adidas,
            Nike, Puma, Timberland, Maison Margiela, Gucci, Balenciaga, Off-White, Stone Island, New Balance и других
            брендов. 2D Lab доступен как дополнительная опция для кастомизации.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/catalog" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
              Перейти в каталог
            </Link>
            <Link href="/editor" className="rounded-md border px-4 py-2">
              Открыть 2D Lab
            </Link>
          </div>
        </div>
        <div className="rounded-xl border bg-[linear-gradient(135deg,rgba(12,12,12,0.12),rgba(255,255,255,0.64))] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Сейчас в фокусе</p>
          <p className="mt-3 text-2xl font-semibold">Базовые брендовые позиции</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Повседневные брендовые вещи</li>
            <li>Популярные бренды и стабильные размеры</li>
            <li>Кастомизация доступна по желанию</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
