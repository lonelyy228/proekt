import { env } from "@/config/env";

const isPlaywrightRuntime = process.env.PLAYWRIGHT_TEST === "1";

export const authConfig = {
  accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  issuer: "apparel-store",
  audience: "apparel-store-users"
} as const;

export const cookieConfig = {
  secure: env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "strict" as const,
  domain: env.COOKIE_DOMAIN,
  accessTokenName: "access_token",
  refreshTokenName: "refresh_token",
  csrfTokenName: "csrf_token"
} as const;

export const paginationConfig = {
  defaultPage: 1,
  defaultPageSize: 12,
  maxPageSize: 50
} as const;

export const rateLimitConfig = {
  auth: { points: isPlaywrightRuntime ? 200 : 10, durationSeconds: 60 },
  checkout: { points: 20, durationSeconds: 60 },
  upload: { points: 10, durationSeconds: 60 },
  adminMutation: { points: isPlaywrightRuntime ? 200 : 30, durationSeconds: 60 }
} as const;

export const uploadConfig = {
  maxImageSizeBytes: 8 * 1024 * 1024,
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
} as const;
