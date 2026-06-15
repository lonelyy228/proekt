"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE_BANNER_STORAGE_KEY = "rsh-cookie-consent";

export const CookieBanner = (): JSX.Element | null => {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(COOKIE_BANNER_STORAGE_KEY);
    setVisible(savedMode !== "accepted" && savedMode !== "necessary");
  }, []);

  const saveConsent = (): void => {
    window.localStorage.setItem(COOKIE_BANNER_STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-2xl overflow-hidden rounded-[24px] border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(244,241,234,0.96))] shadow-[0_20px_60px_rgba(10,10,10,0.14)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(10,10,10,0.08),transparent_32%),linear-gradient(180deg,transparent,rgba(10,10,10,0.02))]" />
      <div className="relative grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end md:p-5">
        <div className="space-y-2.5">
          <p className="text-xs uppercase tracking-[0.28em] text-primary">RSH Privacy</p>

          <div className="space-y-2">
            <p className="text-xl tracking-[0.14em] text-primary sm:text-2xl" style={{ fontFamily: "var(--font-heading)" }}>
              COOKIES
            </p>
            <p className="max-w-xl text-[13px] leading-5 text-foreground sm:text-sm sm:leading-6">
              Мы используем cookie для входа в аккаунт, защиты сессии, работы корзины и устойчивой работы магазина.
              Технические cookie помогают сохранять удобство использования сайта и не ломают сценарий между страницами.
            </p>
          </div>

          <p className="max-w-xl text-[11px] leading-5 text-muted-foreground sm:text-xs sm:leading-6">
            Нажимая «Принять», вы соглашаетесь на стандартное использование cookie в рамках работы RSH, авторизации,
            безопасности и checkout.
          </p>

          <Link href="/privacy" className="text-sm text-muted-foreground underline-offset-4 transition hover:text-primary hover:underline">
            Подробнее о данных и cookie в политике конфиденциальности
          </Link>
        </div>

        <div className="flex flex-col gap-2 md:min-w-[200px]">
          <button
            type="button"
            onClick={saveConsent}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Принять
          </button>
        </div>
      </div>
    </div>
  );
};
