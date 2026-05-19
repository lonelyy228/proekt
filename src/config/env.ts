import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_KEY_ID: z.string().min(1),
  REFRESH_TOKEN_PEPPER: z.string().min(16),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive(),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive(),
  COOKIE_DOMAIN: z.string().min(1),
  REDIS_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_CURRENCY: z.string().length(3).default("usd"),
  STORE_USD_TO_RUB_RATE: z.coerce.number().positive().default(90),
  UPLOADTHING_TOKEN: z.string().optional(),
  UPLOADTHING_APP_ID: z.string().optional(),
  SENTRY_DSN: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const validateProductionEnv = (value: z.infer<typeof envSchema>): void => {
  if (value.NODE_ENV !== "production") {
    return;
  }

  const issues: string[] = [];

  const appUrl = new URL(value.APP_URL);
  if (appUrl.protocol !== "https:") {
    issues.push("APP_URL must use https in production");
  }

  if (appUrl.hostname === "localhost" || appUrl.hostname === "127.0.0.1") {
    issues.push("APP_URL must not target localhost in production");
  }

  const cookieDomain = value.COOKIE_DOMAIN.trim().toLowerCase();
  if (cookieDomain === "localhost") {
    issues.push("COOKIE_DOMAIN must not be localhost in production");
  }

  if (cookieDomain.includes(":")) {
    issues.push("COOKIE_DOMAIN must not contain a port");
  }

  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    issues.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  }

  if (!value.UPLOADTHING_TOKEN || !value.UPLOADTHING_APP_ID) {
    issues.push("UPLOADTHING_TOKEN and UPLOADTHING_APP_ID are required in production");
  }

  if (!value.STRIPE_SECRET_KEY.startsWith("sk_live_")) {
    issues.push("STRIPE_SECRET_KEY must be a live key in production");
  }

  if (issues.length > 0) {
    throw new Error(`Invalid production environment configuration: ${issues.join("; ")}`);
  }
};

validateProductionEnv(parsed.data);

export const env = parsed.data;
export type Env = typeof env;
