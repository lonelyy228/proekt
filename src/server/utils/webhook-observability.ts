import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

type WebhookMetric = "received" | "processed" | "duplicate" | "failed" | "replayed";

type WebhookMetricsSnapshot = {
  windowHours: number;
  generatedAt: string;
  counters: Record<WebhookMetric, number>;
  avgProcessDurationMs: number;
  lastProcessedAt: string | null;
};

const METRICS_TTL_SECONDS = 60 * 60 * 48;
const LATENCY_SUM_FIELD = "latencyMsSum";
const LATENCY_COUNT_FIELD = "latencyCount";
const LAST_PROCESSED_AT_KEY = "obs:webhook:stripe:last_processed_at";

const formatUtcHour = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");

  return `${year}${month}${day}${hour}`;
};

const buildMetricKey = (metric: WebhookMetric, date: Date): string =>
  `obs:webhook:stripe:${metric}:${formatUtcHour(date)}`;

const buildLatencyKey = (date: Date): string => `obs:webhook:stripe:latency:${formatUtcHour(date)}`;

const getWindowHours = (hours: number): Date[] => {
  const now = new Date();
  const values: Date[] = [];

  for (let index = 0; index < hours; index += 1) {
    values.push(new Date(now.getTime() - index * 60 * 60 * 1000));
  }

  return values;
};

const safeToNumber = (value: string | null): number => {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const webhookObservability = {
  increment: async (metric: WebhookMetric, amount = 1): Promise<void> => {
    const now = new Date();
    const key = buildMetricKey(metric, now);

    try {
      const pipeline = redis.pipeline();
      pipeline.incrby(key, amount);
      pipeline.expire(key, METRICS_TTL_SECONDS);
      await pipeline.exec();
    } catch (error: unknown) {
      logger.warn({ err: error, metric }, "Failed to increment webhook metric");
    }
  },

  recordProcessDuration: async (durationMs: number): Promise<void> => {
    const clampedDuration = Math.max(0, Math.round(durationMs));
    const now = new Date();
    const key = buildLatencyKey(now);

    try {
      const pipeline = redis.pipeline();
      pipeline.hincrby(key, LATENCY_SUM_FIELD, clampedDuration);
      pipeline.hincrby(key, LATENCY_COUNT_FIELD, 1);
      pipeline.expire(key, METRICS_TTL_SECONDS);
      pipeline.set(LAST_PROCESSED_AT_KEY, now.toISOString(), "EX", METRICS_TTL_SECONDS);
      await pipeline.exec();
    } catch (error: unknown) {
      logger.warn({ err: error }, "Failed to record webhook process duration");
    }
  },

  getSnapshot: async (windowHours = 24): Promise<WebhookMetricsSnapshot> => {
    const hours = Math.max(1, Math.min(windowHours, 168));
    const points = getWindowHours(hours);

    const counters: Record<WebhookMetric, number> = {
      received: 0,
      processed: 0,
      duplicate: 0,
      failed: 0,
      replayed: 0
    };

    let latencyMsSum = 0;
    let latencyCount = 0;

    try {
      const pipeline = redis.pipeline();
      for (const point of points) {
        pipeline.get(buildMetricKey("received", point));
        pipeline.get(buildMetricKey("processed", point));
        pipeline.get(buildMetricKey("duplicate", point));
        pipeline.get(buildMetricKey("failed", point));
        pipeline.get(buildMetricKey("replayed", point));
        pipeline.hmget(buildLatencyKey(point), LATENCY_SUM_FIELD, LATENCY_COUNT_FIELD);
      }

      const result = await pipeline.exec();
      if (result) {
        let cursor = 0;
        for (let index = 0; index < points.length; index += 1) {
          const receivedRaw = result[cursor]?.[1] as string | null | undefined;
          cursor += 1;
          const processedRaw = result[cursor]?.[1] as string | null | undefined;
          cursor += 1;
          const duplicateRaw = result[cursor]?.[1] as string | null | undefined;
          cursor += 1;
          const failedRaw = result[cursor]?.[1] as string | null | undefined;
          cursor += 1;
          const replayedRaw = result[cursor]?.[1] as string | null | undefined;
          cursor += 1;
          const latencyRaw = result[cursor]?.[1] as [string | null, string | null] | undefined;
          cursor += 1;

          counters.received += safeToNumber(receivedRaw ?? null);
          counters.processed += safeToNumber(processedRaw ?? null);
          counters.duplicate += safeToNumber(duplicateRaw ?? null);
          counters.failed += safeToNumber(failedRaw ?? null);
          counters.replayed += safeToNumber(replayedRaw ?? null);
          latencyMsSum += safeToNumber(latencyRaw?.[0] ?? null);
          latencyCount += safeToNumber(latencyRaw?.[1] ?? null);
        }
      }
    } catch (error: unknown) {
      logger.warn({ err: error }, "Failed to collect webhook metrics snapshot");
    }

    const avgProcessDurationMs = latencyCount > 0 ? Math.round(latencyMsSum / latencyCount) : 0;
    let lastProcessedAt: string | null = null;

    try {
      lastProcessedAt = await redis.get(LAST_PROCESSED_AT_KEY);
    } catch (error: unknown) {
      logger.warn({ err: error }, "Failed to read last webhook processed timestamp");
    }

    return {
      windowHours: hours,
      generatedAt: new Date().toISOString(),
      counters,
      avgProcessDurationMs,
      lastProcessedAt
    };
  }
};
