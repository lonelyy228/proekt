"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { clearCsrfToken, ensureCsrfToken } from "@/lib/csrf-client";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/catalog", label: "Каталог" },
  { href: "/catalog/basics", label: "Basics" },
  { href: "/editor", label: "2D Lab" },
  { href: "/favorites", label: "Избранное" },
  { href: "/cart", label: "Корзина" }
] as const;

const isActivePath = (pathname: string, href: string): boolean => pathname === href || pathname.startsWith(`${href}/`);

export const Header = (): JSX.Element => {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const handleLogout = async (): Promise<void> => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const csrfToken = await ensureCsrfToken();
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "x-csrf-token": csrfToken
        },
        credentials: "include"
      });
    } finally {
      clearCsrfToken();
      queryClient.setQueryData(["auth", "me"], null);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      setIsLoggingOut(false);
      router.push("/");
      router.refresh();
    }
  };

  const renderAuthActions = (): JSX.Element => {
    if (isLoading) {
      return (
        <span className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Проверяем
        </span>
      );
    }

    if (user) {
      const profilePath = user.role === "ADMIN" ? "/admin" : "/profile";

      return (
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Link
            href={profilePath}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition hover:border-primary hover:bg-primary hover:text-primary-foreground",
              isActivePath(pathname, profilePath) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
            )}
          >
            {user.role === "ADMIN" ? "Админ" : "Профиль"}
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:border-destructive hover:text-destructive disabled:opacity-60"
          >
            {isLoggingOut ? "Выходим" : "Выйти"}
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Link
          href="/login"
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition hover:border-primary",
            isActivePath(pathname, "/login") ? "border-primary" : "border-border bg-background"
          )}
        >
          Вход
        </Link>
        <Link
          href="/register"
          className={cn(
            "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
            isActivePath(pathname, "/register") && "ring-2 ring-primary/25"
          )}
        >
          Регистрация
        </Link>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-3" aria-label="RSH home">
          <span
            className="text-3xl tracking-[0.28em] text-primary transition group-hover:tracking-[0.34em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            RSH
          </span>
          <span className="hidden border-l border-border pl-3 text-[10px] uppercase leading-tight tracking-[0.24em] text-muted-foreground sm:block">
            Brand archive
            <br />
            Custom lab
          </span>
        </Link>

        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card lg:hidden"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
          onClick={() => setIsMenuOpen((value) => !value)}
        >
          <span className="relative block h-3.5 w-5">
            <span className={cn("absolute left-0 top-0 h-px w-5 bg-primary transition", isMenuOpen && "top-1.5 rotate-45")} />
            <span className={cn("absolute left-0 top-1.5 h-px w-5 bg-primary transition", isMenuOpen && "opacity-0")} />
            <span className={cn("absolute bottom-0 left-0 h-px w-5 bg-primary transition", isMenuOpen && "bottom-2 -rotate-45")} />
          </span>
        </button>

        <nav className="hidden items-center gap-2 rounded-full border border-border/80 bg-card/75 p-1 text-sm uppercase tracking-[0.12em] shadow-sm lg:flex">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-2 transition hover:bg-muted",
                isActivePath(pathname, link.href) && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">{renderAuthActions()}</div>
      </div>

      <div
        className={cn(
          "grid border-t border-border/70 bg-background/95 px-4 transition-all lg:hidden",
          isMenuOpen ? "grid-rows-[1fr] py-4" : "grid-rows-[0fr] py-0"
        )}
      >
        <div className="overflow-hidden">
          <nav className="grid gap-2 text-sm uppercase tracking-[0.14em]">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-xl border border-border bg-card px-4 py-3",
                  isActivePath(pathname, link.href) && "border-primary bg-primary text-primary-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 border-t border-border pt-3">{renderAuthActions()}</div>
        </div>
      </div>
    </header>
  );
};