"use client";

import { useQuery } from "@tanstack/react-query";
import { clearCsrfToken } from "@/lib/csrf-client";

const fetchMe = async (): Promise<{ id: string; email: string; role: "USER" | "ADMIN"; twoFactorEnabled: boolean } | null> => {
  const response = await fetch("/api/auth/me", { method: "GET", credentials: "include" });

  if (response.status === 401) {
    clearCsrfToken();
    return null;
  }

  if (!response.ok) {
    throw new Error("Не удалось загрузить профиль пользователя");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: { id: string; email: string; role: "USER" | "ADMIN"; twoFactorEnabled: boolean };
  };

  return payload.data;
};

export const useAuth = () =>
  useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe
  });
