"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { setCsrfToken } from "@/lib/csrf-client";
import { mergeGuestCartIntoAccount } from "@/lib/guest-cart-merge";

type RegisterResponse = {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      role: "USER" | "ADMIN";
    };
    csrfToken: string;
  };
  error?: {
    message: string;
    details?: string[];
  };
};

const readableValidationMessage = (payload: RegisterResponse): string => {
  const firstDetail = payload.error?.details?.[0]
    ?.replace(/^password:\s*/i, "")
    .replace(/^email:\s*/i, "");

  return firstDetail ?? payload.error?.message ?? "Не удалось зарегистрироваться";
};

type PasswordRequirement = {
  id: string;
  label: string;
  isValid: boolean;
};

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const passwordRequirements: PasswordRequirement[] = [
    {
      id: "length",
      label: "Минимум 10 символов",
      isValid: password.length >= 10
    },
    {
      id: "uppercase",
      label: "Есть заглавная латинская буква",
      isValid: /[A-Z]/.test(password)
    },
    {
      id: "lowercase",
      label: "Есть строчная латинская буква",
      isValid: /[a-z]/.test(password)
    },
    {
      id: "digit",
      label: "Есть цифра",
      isValid: /[0-9]/.test(password)
    },
    {
      id: "special",
      label: "Есть спецсимвол, например !",
      isValid: /[^A-Za-z0-9]/.test(password)
    }
  ];
  const passedRequirements = passwordRequirements.filter((requirement) => requirement.isValid).length;
  const passwordStrength =
    password.length === 0 ? "empty" : passedRequirements <= 2 ? "weak" : passedRequirements < passwordRequirements.length ? "medium" : "strong";
  const passwordStrengthLabel =
    passwordStrength === "strong"
      ? "Надёжный пароль"
      : passwordStrength === "medium"
        ? "Почти готово"
        : passwordStrength === "weak"
          ? "Слабый пароль"
          : "Введите пароль";
  const passwordStrengthBarClass =
    passwordStrength === "strong"
      ? "w-full bg-emerald-600"
      : passwordStrength === "medium"
        ? "w-2/3 bg-amber-500"
        : passwordStrength === "weak"
          ? "w-1/3 bg-destructive"
          : "w-0 bg-muted";

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

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(readableValidationMessage(payload));
      }

      setCsrfToken(payload.data.csrfToken);
      queryClient.setQueryData(["auth", "me"], {
        id: payload.data.user.id,
        email: payload.data.user.email,
        role: payload.data.user.role,
        twoFactorEnabled: false
      });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      await mergeGuestCartIntoAccount(queryClient);
      router.push("/profile");
      router.refresh();
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
        <p className="mt-2 text-sm text-muted-foreground">
          Создайте аккаунт для заказов, избранного и кастом-дизайнов.
        </p>
      </div>

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
            autoComplete="new-password"
            minLength={10}
            aria-describedby="password-requirements"
          />
          <span className="block text-xs text-muted-foreground">
            Минимум 10 символов: большая и маленькая латинская буква, цифра и спецсимвол.
          </span>
        </label>

        <div id="password-requirements" className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Надёжность
            </span>
            <span
              className={
                passwordStrength === "strong"
                  ? "text-xs font-medium text-emerald-700"
                  : passwordStrength === "medium"
                    ? "text-xs font-medium text-amber-700"
                    : passwordStrength === "weak"
                      ? "text-xs font-medium text-destructive"
                      : "text-xs font-medium text-muted-foreground"
              }
            >
              {passwordStrengthLabel}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
            <div className={`h-full rounded-full transition-all duration-300 ${passwordStrengthBarClass}`} />
          </div>
          <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
            {passwordRequirements.map((requirement) => (
              <li
                key={requirement.id}
                className={requirement.isValid ? "flex items-center gap-2 text-emerald-700" : "flex items-center gap-2 text-muted-foreground"}
              >
                <span
                  aria-hidden="true"
                  className={
                    requirement.isValid
                      ? "flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white"
                      : "flex size-4 items-center justify-center rounded-full border border-muted-foreground/40 text-[10px]"
                  }
                >
                  {requirement.isValid ? "✓" : "•"}
                </span>
                {requirement.label}
              </li>
            ))}
          </ul>
        </div>

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
          {isSubmitting ? "Создаём аккаунт..." : "Зарегистрироваться"}
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

