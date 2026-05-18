"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearCsrfToken, ensureCsrfToken } from "@/lib/csrf-client";

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
};

type Setup2FaResponse = {
  secret: string;
  otpAuth: string;
  qrCodeDataUrl: string;
};

type Enable2FaResponse = {
  backupCodes: string[];
};

type Verify2FaResponse = {
  valid: boolean;
  usedBackupCode?: boolean;
};

type SessionItem = {
  id: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  deviceType: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

const formatSessionDate = (value: string): string =>
  new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

const getSessionStatusLabel = (status: SessionItem["status"]): string => {
  switch (status) {
    case "ACTIVE":
      return "Активна";
    case "REVOKED":
      return "Завершена";
    case "EXPIRED":
      return "Истекла";
    default:
      return status;
  }
};

const fetchSessions = async (): Promise<SessionItem[]> => {
  const response = await fetch("/api/auth/sessions", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить список сессий");
  }

  const payload = (await response.json()) as ApiPayload<SessionItem[]>;
  return payload.data ?? [];
};

export const ProfileSecurityPanel = ({ twoFactorEnabled }: { twoFactorEnabled: boolean }): JSX.Element => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<"setup" | "enable" | "verify" | "logout" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [setupData, setSetupData] = useState<Setup2FaResponse | null>(null);
  const [code, setCode] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: fetchSessions
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(`/api/auth/sessions?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken
        },
        credentials: "include"
      });

      const payload = (await response.json()) as ApiPayload<{ revoked: boolean }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Не удалось завершить сессию");
      }

      return payload.data;
    },
    onSuccess: () => {
      setInfoMessage("Сессия завершена.");
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка завершения сессии");
    }
  });

  const runWithCsrf = async <T,>(
    url: string,
    payload: Record<string, string> | null
  ): Promise<ApiPayload<T>> => {
    const csrfToken = await ensureCsrfToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken
      },
      credentials: "include",
      body: payload ? JSON.stringify(payload) : undefined
    });

    return (await response.json()) as ApiPayload<T>;
  };

  const handleSetup2Fa = async (): Promise<void> => {
    setLoadingAction("setup");
    setErrorMessage("");
    setInfoMessage("");

    try {
      const payload = await runWithCsrf<Setup2FaResponse>("/api/auth/2fa/setup", null);
      if (!payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось инициализировать 2FA");
      }

      setSetupData(payload.data);
      setInfoMessage("Сканируйте QR-код в приложении-аутентификаторе и подтвердите код ниже.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка инициализации 2FA");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEnable2Fa = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoadingAction("enable");
    setErrorMessage("");
    setInfoMessage("");

    try {
      const payload = await runWithCsrf<Enable2FaResponse>("/api/auth/2fa/enable", { code });
      if (!payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Не удалось включить 2FA");
      }

      setBackupCodes(payload.data.backupCodes);
      setInfoMessage("2FA включена. Сохраните резервные коды в безопасном месте.");
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка включения 2FA");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleVerify2Fa = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoadingAction("verify");
    setErrorMessage("");
    setInfoMessage("");

    try {
      const payload = await runWithCsrf<Verify2FaResponse>("/api/auth/2fa/verify", { code: verifyCode });
      if (!payload.success || !payload.data?.valid) {
        throw new Error(payload.error?.message ?? "Код 2FA не прошел проверку");
      }

      setInfoMessage(
        payload.data.usedBackupCode
          ? "Код принят. Использован резервный код."
          : "Код 2FA успешно подтвержден."
      );
      setVerifyCode("");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка проверки 2FA");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogout = async (): Promise<void> => {
    setLoadingAction("logout");
    setErrorMessage("");
    setInfoMessage("");

    try {
      const payload = await runWithCsrf<{ success: boolean }>("/api/auth/logout", null);
      if (!payload.success) {
        throw new Error(payload.error?.message ?? "Не удалось завершить сессию");
      }

      clearCsrfToken();
      router.push("/login");
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка выхода из аккаунта");
      setLoadingAction(null);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Безопасность аккаунта</h2>
          <p className="text-sm text-muted-foreground">2FA: {twoFactorEnabled ? "включена" : "выключена"}</p>
        </div>
        <button
          className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary"
          onClick={handleLogout}
          type="button"
          disabled={loadingAction === "logout"}
        >
          {loadingAction === "logout" ? "Выходим..." : "Выйти из аккаунта"}
        </button>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      {infoMessage ? <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">{infoMessage}</p> : null}

      {!twoFactorEnabled ? (
        <div className="space-y-3">
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
            onClick={handleSetup2Fa}
            type="button"
            disabled={loadingAction === "setup"}
          >
            {loadingAction === "setup" ? "Готовим 2FA..." : "Настроить 2FA"}
          </button>

          {setupData ? (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">
                Если QR не считывается, используйте секрет вручную: <span className="font-medium">{setupData.secret}</span>
              </p>
              <Image
                src={setupData.qrCodeDataUrl}
                alt="QR код для 2FA"
                width={176}
                height={176}
                className="rounded-md border bg-white p-2"
                unoptimized
              />
              <form className="space-y-2" onSubmit={handleEnable2Fa}>
                <label className="block space-y-1">
                  <span className="text-sm">Код из приложения</span>
                  <input
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="6 цифр"
                    required
                  />
                </label>
                <button
                  className="rounded-md border px-4 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-60"
                  disabled={loadingAction === "enable"}
                  type="submit"
                >
                  {loadingAction === "enable" ? "Подтверждаем..." : "Включить 2FA"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : (
        <form className="space-y-2 rounded-lg border p-4" onSubmit={handleVerify2Fa}>
          <label className="block space-y-1">
            <span className="text-sm">Проверка 2FA (TOTP или резервный код)</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={verifyCode}
              onChange={(event) => setVerifyCode(event.target.value)}
              placeholder="6 цифр или 10-символьный резервный код"
              required
            />
          </label>
          <button
            className="rounded-md border px-4 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-60"
            disabled={loadingAction === "verify"}
            type="submit"
          >
            {loadingAction === "verify" ? "Проверяем..." : "Проверить код"}
          </button>
        </form>
      )}

      {backupCodes.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-medium">Резервные коды (показываются один раз)</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {backupCodes.map((backupCode) => (
              <code key={backupCode} className="rounded-md border px-2 py-1">
                {backupCode}
              </code>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="text-lg font-semibold">Активные сессии</h3>
        {sessionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Загружаем список сессий...</p> : null}
        {sessionsQuery.isError ? <p className="text-sm text-destructive">Не удалось загрузить сессии.</p> : null}
        <div className="space-y-2">
          {sessionsQuery.data?.map((session) => (
            <article key={session.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {session.isCurrent ? "Текущее устройство" : session.deviceType || "Устройство"}
                </p>
                <span className="text-muted-foreground">{getSessionStatusLabel(session.status)}</span>
              </div>
              <p className="mt-1 text-muted-foreground">IP: {session.ipAddress ?? "не определен"}</p>
              <p className="text-muted-foreground">UA: {session.userAgent ?? "не определен"}</p>
              <p className="text-muted-foreground">Последняя активность: {formatSessionDate(session.lastSeenAt)}</p>
              <p className="text-muted-foreground">Истекает: {formatSessionDate(session.expiresAt)}</p>
              {!session.isCurrent && session.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="mt-2 rounded-md border px-3 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-60"
                  onClick={() => revokeSessionMutation.mutate(session.id)}
                  disabled={revokeSessionMutation.isPending}
                >
                  Завершить сессию
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
