"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type RegisterResponse = {
  success: boolean;
  error?: {
    message: string;
  };
};

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Пароли не совпадают");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const payload = (await response.json()) as RegisterResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Не удалось зарегистрироваться");
      }

      router.push("/login?registered=1");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка регистрации. Попробуйте позже.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md space-y-6 rounded-xl border bg-card p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-primary">RSH Access</p>
        <h1 className="mt-2 text-3xl font-semibold">Регистрация</h1>
        <p className="mt-2 text-sm text-muted-foreground">Создайте аккаунт для заказов, избранного и кастом-дизайнов.</p>
      </div>

      {errorMessage ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p> : null}

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
            autoComplete="new-password"
            minLength={10}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Подтвердите пароль</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
            minLength={10}
          />
        </label>

        <button
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Создаем аккаунт..." : "Зарегистрироваться"}
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Войти
        </Link>
      </p>
    </section>
  );
}
