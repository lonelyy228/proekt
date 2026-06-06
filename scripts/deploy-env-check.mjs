import { existsSync, readFileSync } from "node:fs";

const REQUIRED_ENV = [
  "NODE_ENV",
  "APP_URL",
  "COOKIE_DOMAIN",
  "DATABASE_URL",
  "DIRECT_URL",
  "REDIS_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_KEY_ID",
  "REFRESH_TOKEN_PEPPER",
  "ACCESS_TOKEN_TTL_SECONDS",
  "REFRESH_TOKEN_TTL_DAYS",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_CURRENCY",
  "UPLOADTHING_TOKEN",
  "UPLOADTHING_APP_ID"
];

const OPTIONAL_ENV = [
  "STORE_USD_TO_RUB_RATE",
  "SENTRY_DSN",
  "SENTRY_ERROR_SAMPLE_RATE",
  "SENTRY_WARNING_SAMPLE_RATE",
  "SENTRY_INFO_SAMPLE_RATE"
];

const parseEnvFile = (path) => {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
          return [line, ""];
        }

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['\"]|['\"]$/g, "");
        return [key, value];
      })
  );
};

const sourcePath = process.argv[2];
const fileEnv = sourcePath ? parseEnvFile(sourcePath) : {};
const env = { ...fileEnv, ...process.env };
const issues = [];

const addIssue = (message) => issues.push(message);

for (const key of REQUIRED_ENV) {
  if (!env[key] || env[key].trim().length === 0) {
    addIssue(`${key} is required`);
  }
}

const assertUrl = (key) => {
  try {
    return new URL(env[key]);
  } catch {
    addIssue(`${key} must be a valid URL`);
    return null;
  }
};

const appUrl = assertUrl("APP_URL");
assertUrl("REDIS_URL");

if (env.NODE_ENV !== "production") {
  addIssue("NODE_ENV must be production for hosting");
}

if (appUrl) {
  if (appUrl.protocol !== "https:") {
    addIssue("APP_URL must use https in production");
  }

  if (["localhost", "127.0.0.1", "::1"].includes(appUrl.hostname)) {
    addIssue("APP_URL must not point to localhost in production");
  }
}

const cookieDomain = env.COOKIE_DOMAIN?.trim().toLowerCase() ?? "";
if (["localhost", "127.0.0.1", "::1"].includes(cookieDomain)) {
  addIssue("COOKIE_DOMAIN must be your public domain, not localhost");
}

if (cookieDomain.includes(":")) {
  addIssue("COOKIE_DOMAIN must not contain a port");
}

if ((env.JWT_ACCESS_SECRET ?? "").length < 32) {
  addIssue("JWT_ACCESS_SECRET must be at least 32 characters");
}

if ((env.JWT_REFRESH_SECRET ?? "").length < 32) {
  addIssue("JWT_REFRESH_SECRET must be at least 32 characters");
}

if (env.JWT_ACCESS_SECRET && env.JWT_REFRESH_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
  addIssue("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
}

if ((env.REFRESH_TOKEN_PEPPER ?? "").length < 16) {
  addIssue("REFRESH_TOKEN_PEPPER must be at least 16 characters");
}

if (!/^sk_live_/.test(env.STRIPE_SECRET_KEY ?? "")) {
  addIssue("STRIPE_SECRET_KEY must be a live Stripe secret key (sk_live_...) for production");
}

if (!/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET ?? "")) {
  addIssue("STRIPE_WEBHOOK_SECRET must start with whsec_");
}

for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const value = env[key] ?? "";
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    addIssue(`${key} must be a PostgreSQL connection string`);
  }

  if (value.includes("localhost") || value.includes("127.0.0.1")) {
    addIssue(`${key} must not target localhost in production`);
  }
}

const currency = env.STRIPE_PRICE_CURRENCY ?? "";
if (!/^[a-z]{3}$/.test(currency)) {
  addIssue("STRIPE_PRICE_CURRENCY must be a 3-letter lowercase ISO currency, for example rub");
}

for (const key of OPTIONAL_ENV) {
  if (!env[key]) {
    console.warn(`[deploy:env-check] optional ${key} is not set`);
  }
}

if (issues.length > 0) {
  console.error("\n[deploy:env-check] failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log("[deploy:env-check] production environment looks deploy-ready");
}
