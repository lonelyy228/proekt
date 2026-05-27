"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export const Header = (): JSX.Element => {
  const { data: user } = useAuth();

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-3xl tracking-[0.2em]" style={{ fontFamily: "var(--font-heading)" }}>
          RSH
        </Link>

        <nav className="flex items-center gap-4 text-sm uppercase tracking-wide">
          <Link href="/catalog" className="hover:text-primary">
            Каталог
          </Link>
          <Link href="/catalog/basics" className="hover:text-primary">
            Basics
          </Link>
          <Link href="/editor" className="hover:text-primary">
            2D Lab
          </Link>
          <Link href="/favorites" className="hover:text-primary">
            Избранное
          </Link>
          <Link href="/cart" className="hover:text-primary">
            Корзина
          </Link>
          {user ? (
            <Link href={user.role === "ADMIN" ? "/admin" : "/profile"} className="hover:text-primary">
              {user.role === "ADMIN" ? "Админ" : "Профиль"}
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-primary">
                Вход
              </Link>
              <Link href="/register" className="hover:text-primary">
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
