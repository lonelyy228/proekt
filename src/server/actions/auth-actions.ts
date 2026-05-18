"use server";

import { loginSchema } from "@/server/validators/auth";
import { authService } from "@/server/services/auth-service";
import { setAccessCookie, setRefreshCookie } from "@/server/utils/cookies";
import { getSessionMeta } from "@/server/utils/session-meta";
import { issueCsrfCookie } from "@/server/utils/csrf";
import { AppError } from "@/server/utils/errors";
import { localizeAppErrorMessage } from "@/server/utils/error-localization";

export const loginAction = async (formData: FormData): Promise<{ success: boolean; message?: string }> => {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totpCode: formData.get("totpCode")
  });

  if (!parsed.success) {
    return { success: false, message: "Некорректные данные формы" };
  }

  try {
    const session = await authService.login({
      ...parsed.data,
      ...getSessionMeta(),
      email: parsed.data.email.toLowerCase()
    });

    setAccessCookie(session.accessToken);
    setRefreshCookie(session.refreshToken);
    issueCsrfCookie();

    return { success: true };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return { success: false, message: localizeAppErrorMessage(error.code, error.message) };
    }

    return { success: false, message: "Непредвиденная ошибка. Попробуйте позже." };
  }
};
