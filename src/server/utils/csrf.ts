import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { cookieConfig } from "@/config/constants";
import { env } from "@/config/env";
import { randomToken } from "@/server/utils/crypto";
import { AppError } from "@/server/utils/errors";

const createSignature = (token: string): string =>
  createHmac("sha256", env.JWT_ACCESS_SECRET).update(token).digest("hex");

export const issueCsrfCookie = (): string => {
  const token = randomToken(24);
  const signature = createSignature(token);
  cookies().set(cookieConfig.csrfTokenName, `${token}.${signature}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: cookieConfig.secure,
    domain: cookieConfig.domain,
    path: "/"
  });
  return token;
};

export const assertValidCsrf = (): void => {
  const headerToken = headers().get("x-csrf-token");
  const cookieValue = cookies().get(cookieConfig.csrfTokenName)?.value;

  if (!headerToken || !cookieValue) {
    throw new AppError("AUTH_ERROR", "Missing CSRF token");
  }

  const [rawToken, signature] = cookieValue.split(".");

  if (!rawToken || !signature || rawToken !== headerToken) {
    throw new AppError("AUTH_ERROR", "Invalid CSRF token");
  }

  const expectedSignature = createSignature(rawToken);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new AppError("AUTH_ERROR", "Invalid CSRF token signature");
  }
};
