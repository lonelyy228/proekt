import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { AdminBackupsSnapshot } from "@/features/admin/types/admin-operations";

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

const detectDatabaseProvider = (): string => {
  try {
    const url = new URL(env.DATABASE_URL);
    if (url.hostname.includes("neon.tech")) {
      return "Neon PostgreSQL";
    }
    if (url.hostname.includes("vercel-storage.com") || url.hostname.includes("supabase")) {
      return "Managed PostgreSQL";
    }
    return `PostgreSQL (${url.hostname})`;
  } catch {
    return "PostgreSQL";
  }
};

const isPitrLikelySupported = (): boolean => {
  try {
    const url = new URL(env.DATABASE_URL);
    return url.hostname.includes("neon.tech") || url.hostname.includes("vercel-storage.com");
  } catch {
    return false;
  }
};

const checkDatabaseReachability = async (): Promise<boolean> => {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2500);
    return true;
  } catch (error: unknown) {
    logger.warn({ err: error }, "Backups health DB check failed");
    return false;
  }
};

export const adminBackupsService = {
  getSnapshot: async (): Promise<AdminBackupsSnapshot> => {
    const databaseReachable = await checkDatabaseReachability();
    const uploadConfigured =
      env.UPLOAD_PROVIDER !== "uploadthing" || (Boolean(env.UPLOADTHING_TOKEN) && Boolean(env.UPLOADTHING_APP_ID));
    const pitrLikelySupported = isPitrLikelySupported();

    return {
      generatedAt: new Date().toISOString(),
      provider: {
        database: detectDatabaseProvider(),
        uploadStorage:
          env.UPLOAD_PROVIDER === "uploadthing"
            ? uploadConfigured
              ? "UploadThing Object Storage"
              : "Не настроено"
            : "Local server storage"
      },
      status: {
        databaseReachable,
        uploadConfigured,
        pitrLikelySupported
      },
      policyChecklist: [
        "Managed snapshots на уровне PostgreSQL-провайдера",
        "Point-in-time recovery включен и проверяется на staging",
        "Retention policy: минимум 14 дней для production и 7 дней для preview",
        "Object storage assets: versioning + lifecycle rules + блокировка публичной записи"
      ],
      restoreRunbook: [
        "Подтвердить точку восстановления и временно заморозить write-операции storefront/admin",
        "Выполнить restore в новый инстанс БД и прогнать smoke-check auth/checkout/admin",
        "Переключить DATABASE_URL на восстановленный инстанс и провалидировать payment webhooks",
        "Оформить постмортем, обновить алерты и чеклисты реагирования"
      ],
      drills: [
        {
          name: "Monthly restore drill",
          cadence: "Ежемесячно",
          objective: "Проверка полного восстановления БД и storefront",
          target: "RTO <= 60 мин",
          owner: "Platform Engineer"
        },
        {
          name: "Quarterly webhook replay drill",
          cadence: "Ежеквартально",
          objective: "Проверка replay payment-событий после восстановления",
          target: "0 lost events",
          owner: "Payments Owner"
        },
        {
          name: "Half-year chaos rehearsal",
          cadence: "2 раза в год",
          objective: "Командная отработка инцидента в нерабочее время",
          target: "RPO <= 15 мин",
          owner: "Incident Commander"
        }
      ],
      notes: [
        "UI показывает операционную готовность и не заменяет провайдерские backup-консоли",
        "Факт актуальных snapshot/PITR нужно подтверждать в Neon/Vercel dashboard"
      ]
    };
  }
};
