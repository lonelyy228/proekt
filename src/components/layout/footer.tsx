import Link from "next/link";

const commerceLinks = [
  { href: "/delivery", label: "Доставка" },
  { href: "/returns", label: "Возврат" },
  { href: "/contacts", label: "Контакты" }
] as const;

const legalLinks = [
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Пользовательское соглашение" },
  { href: "/offer", label: "Публичная оферта" }
] as const;

export const Footer = (): JSX.Element => {
  return (
    <footer className="mt-16 border-t border-border/80 bg-card/85">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="text-3xl tracking-[0.28em] text-primary" style={{ fontFamily: "var(--font-heading)" }}>
              RSH
            </p>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Нишевый русскоязычный магазин брендовой одежды и кастомных базовых изделий RSH BASICS с 2D-редактором.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Сервис</p>
          <nav className="mt-4 grid gap-3 text-sm text-muted-foreground">
            {commerceLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-primary">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Документы</p>
          <nav className="mt-4 grid gap-3 text-sm text-muted-foreground">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-primary">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};
