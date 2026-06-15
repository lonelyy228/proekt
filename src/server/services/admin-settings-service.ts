import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { stripe } from "@/lib/stripe";
import { AdminRuntimeCheck, AdminRuntimeSnapshot } from "@/features/admin/types/admin-operations";

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const getDatabaseCheck = async (): Promise<AdminRuntimeCheck> => {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2500);
    return {
      key: "database",
      label: "PostgreSQL",
      description: "Проверка доступности primary database",
      status: "HEALTHY",
      passed: true,
      message: "Подключение установлено"
    };
  } catch (error: unknown) {
    logger.warn({ err: error }, "Database runtime check failed");
    return {
      key: "database",
      label: "PostgreSQL",
      description: "Проверка доступности primary database",
      status: "CRITICAL",
      passed: false,
      message: "Нет подключения к базе"
    };
  }
};

const getRedisCheck = async (): Promise<AdminRuntimeCheck> => {
  try {
    const pong = await withTimeout(redis.ping(), 2500);
    const ok = pong.toUpperCase() === "PONG";

    return {
      key: "redis",
      label: "Redis",
      description: "Rate limit storage и кэш-операции",
      status: ok ? "HEALTHY" : "CRITICAL",
      passed: ok,
      message: ok ? "Redis отвечает" : "Redis не отвечает"
    };
  } catch (error: unknown) {
    logger.warn({ err: error }, "Redis runtime check failed");
    return {
      key: "redis",
      label: "Redis",
      description: "Rate limit storage и кэш-операции",
      status: "CRITICAL",
      passed: false,
      message: "Нет подключения к Redis"
    };
  }
};

const getStripeCheck = (): AdminRuntimeCheck => {
  const configured =
    env.PAYMENT_PROVIDER === "stripe"
      ? env.STRIPE_SECRET_KEY.length > 0 && env.STRIPE_WEBHOOK_SECRET.length > 0
      : env.PAYMENT_PROVIDER === "cloudpayments"
        ? env.CLOUDPAYMENTS_PUBLIC_ID.length > 0 && env.CLOUDPAYMENTS_API_SECRET.length > 0
        : true;

  return {
    key: "stripe",
    label: "Payments",
    description: "Проверка конфигурации платежного провайдера",
    status: configured ? "HEALTHY" : "CRITICAL",
    passed: configured,
    message:
      env.PAYMENT_PROVIDER === "stripe"
        ? configured
          ? `Stripe настроен (API ${stripe?.getApiField("version") ?? "default"})`
          : "Stripe не настроен"
        : env.PAYMENT_PROVIDER === "cloudpayments"
          ? configured
            ? "CloudPayments настроен"
            : "CloudPayments не настроен"
        : `Используется провайдер ${env.PAYMENT_PROVIDER}`
  };
};

const getUploadCheck = (): AdminRuntimeCheck => {
  const hasToken = Boolean(env.UPLOADTHING_TOKEN);
  const hasAppId = Boolean(env.UPLOADTHING_APP_ID);
  const configured = env.UPLOAD_PROVIDER !== "uploadthing" || (hasToken && hasAppId);

  return {
    key: "uploads",
    label: "Upload provider",
    description: "Object storage для ассетов и превью дизайнов",
    status: configured ? "HEALTHY" : "WARNING",
    passed: configured,
    message:
      env.UPLOAD_PROVIDER === "uploadthing"
        ? configured
          ? "UploadThing настроен"
          : "Проверьте UPLOADTHING_TOKEN и UPLOADTHING_APP_ID"
        : "Используется локальный upload provider"
  };
};

const getSentryCheck = (): AdminRuntimeCheck => {
  const configured = Boolean(env.SENTRY_DSN);

  return {
    key: "sentry",
    label: "Sentry",
    description: "Централизованный error monitoring",
    status: configured ? "HEALTHY" : "WARNING",
    passed: configured,
    message: configured ? "Мониторинг подключен" : "SENTRY_DSN не задан"
  };
};

const getSentrySamplingSnapshot = () => ({
  configured: Boolean(env.SENTRY_DSN),
  errorRate: env.SENTRY_ERROR_SAMPLE_RATE,
  warningRate: env.SENTRY_WARNING_SAMPLE_RATE,
  infoRate: env.SENTRY_INFO_SAMPLE_RATE
});

const getCookieDomainCheck = (): AdminRuntimeCheck => {
  const isLocalDomain = env.COOKIE_DOMAIN.includes("localhost");

  return {
    key: "cookies",
    label: "Cookie domain",
    description: "Проверка доменной стратегии secure cookies",
    status: isLocalDomain ? "WARNING" : "HEALTHY",
    passed: !isLocalDomain,
    message: isLocalDomain
      ? "Локальный домен допустим для dev, но не для production"
      : `Домен настроен: ${env.COOKIE_DOMAIN}`
  };
};

export const adminSettingsService = {
  getRuntimeSnapshot: async (): Promise<AdminRuntimeSnapshot> => {
    const checks = await Promise.all([
      getDatabaseCheck(),
      getRedisCheck(),
      Promise.resolve(getStripeCheck()),
      Promise.resolve(getUploadCheck()),
      Promise.resolve(getSentryCheck()),
      Promise.resolve(getCookieDomainCheck())
    ]);

    const summary = checks.reduce(
      (acc, item) => {
        if (item.status === "HEALTHY") {
          acc.healthy += 1;
        } else if (item.status === "WARNING") {
          acc.warning += 1;
        } else {
          acc.critical += 1;
        }
        return acc;
      },
      { healthy: 0, warning: 0, critical: 0 }
    );

    return {
      generatedAt: new Date().toISOString(),
      checks,
      summary,
      sentrySampling: getSentrySamplingSnapshot(),
      securityControls: [
        "JWT access + rotating refresh token, хранение только в HttpOnly cookies",
        "CSRF-проверка для state-changing запросов",
        "RBAC-защита admin namespace на route/service слоях",
        "Rate limiting на auth/admin/checkout/upload мутациях",
        "Аудит привилегированных операций в admin logs"
      ],
      operationsChecklist: [
        "Ротация JWT signing keys и webhook secrets по регламенту",
        "Smoke-check после ротации: auth, checkout, admin critical paths",
        "Еженедельная проверка алертов и error budget по Sentry",
        "Контроль Redis/DB latency и статус webhook backlog",
        "Ежемесячный recovery drill для резервных копий"
      ]
    };
  }
};
