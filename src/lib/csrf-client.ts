type CsrfPayload = {
  success: boolean;
  data?: {
    csrfToken: string;
  };
  error?: {
    message?: string;
  };
};

let csrfTokenCache: string | null = null;

export const setCsrfToken = (token: string): void => {
  csrfTokenCache = token;
};

export const clearCsrfToken = (): void => {
  csrfTokenCache = null;
};

export const ensureCsrfToken = async (): Promise<string> => {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  const response = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Не удалось получить CSRF-токен");
  }

  const payload = (await response.json()) as CsrfPayload;
  const token = payload.data?.csrfToken;

  if (!token) {
    throw new Error(payload.error?.message ?? "CSRF-токен не получен");
  }

  csrfTokenCache = token;
  return token;
};
