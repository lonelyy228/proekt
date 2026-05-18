import { cookies } from "next/headers";
import { authConfig, cookieConfig } from "@/config/constants";

export const setAccessCookie = (token: string): void => {
  cookies().set(cookieConfig.accessTokenName, token, {
    httpOnly: cookieConfig.httpOnly,
    sameSite: cookieConfig.sameSite,
    secure: cookieConfig.secure,
    domain: cookieConfig.domain,
    path: "/",
    maxAge: authConfig.accessTokenTtlSeconds
  });
};

export const setRefreshCookie = (token: string): void => {
  cookies().set(cookieConfig.refreshTokenName, token, {
    httpOnly: cookieConfig.httpOnly,
    sameSite: cookieConfig.sameSite,
    secure: cookieConfig.secure,
    domain: cookieConfig.domain,
    path: "/api/auth/refresh",
    maxAge: authConfig.refreshTokenTtlDays * 24 * 60 * 60
  });
};

export const clearAuthCookies = (): void => {
  const store = cookies();
  const expireAt = new Date(0);

  store.set(cookieConfig.accessTokenName, "", {
    httpOnly: cookieConfig.httpOnly,
    sameSite: cookieConfig.sameSite,
    secure: cookieConfig.secure,
    domain: cookieConfig.domain,
    path: "/",
    expires: expireAt
  });

  store.set(cookieConfig.refreshTokenName, "", {
    httpOnly: cookieConfig.httpOnly,
    sameSite: cookieConfig.sameSite,
    secure: cookieConfig.secure,
    domain: cookieConfig.domain,
    path: "/api/auth/refresh",
    expires: expireAt
  });

  store.set(cookieConfig.csrfTokenName, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: cookieConfig.secure,
    domain: cookieConfig.domain,
    path: "/",
    expires: expireAt
  });
};

export const getAccessCookie = (): string | undefined => cookies().get(cookieConfig.accessTokenName)?.value;
export const getRefreshCookie = (): string | undefined => cookies().get(cookieConfig.refreshTokenName)?.value;
