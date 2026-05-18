import Redis from "ioredis";
import { env } from "@/config/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    enableReadyCheck: false,
    maxRetriesPerRequest: 2,
    lazyConnect: true
  });

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
