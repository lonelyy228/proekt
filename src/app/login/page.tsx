"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setCsrfToken } from "@/lib/csrf-client";

type LoginResponse = {
  success: boolean;
  data?: {
    user: {
      role: "USER" | "ADMIN";
    };
    csrfToken: string;
  };
  error?: {
    message: string;
  };
};

const isSafePath = (value: string): boolean => value.startsWith("/") && !value.startsWith("//");

const LoginForm = (): JSX.Element => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [totpCode, setTotpCode] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const successHint = useMemo(
    () => (searchParams.get("registered") === "1" ? "Регистрация завершена. Выполните вход." : ""),
    [searchParams]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          totpCode: totpCode.trim().length > 0 ? totpCode.trim() : undefined
        })
      });

      const payload = (await response.json()) as LoginResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось выполнить вход");
      }

      setCsrfToken(payload.data.csrfToken);
      const defaultPath = payload.data.user.role === "ADMIN" ? "/admin" : "/profile";
      const targetPath = nextPath && isSafePath(nextPath) ? nextPath : defaultPath;
      router.push(targetPath);
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка входа. Попробуйте позже.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md space-y-6 rounded-xl border bg-card p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Access</p>
        <h1 className="mt-2 text-3xl font-semibold">Вход в аккаунт</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Войдите, чтобы управлять корзиной, избранным и заказами.
        </p>
      </div>

      {successHint ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          {successHint}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm">Email</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Пароль</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Код 2FA (если включен)</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            type="text"
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value)}
            autoComplete="one-time-code"
          />
        </label>

        <button
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Входим..." : "Войти"}
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-primary hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </section>
  );
};

const LoginPageFallback = (): JSX.Element => (
  <section className="mx-auto max-w-md space-y-6 rounded-xl border bg-card p-6">
    <p className="text-sm text-muted-foreground">Подготавливаем форму входа...</p>
  </section>
);

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginForm />
    </Suspense>
  );
}
