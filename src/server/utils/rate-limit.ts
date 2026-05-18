import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "@/lib/redis";
import { AppError } from "@/server/utils/errors";

export const createRateLimiter = (points: number, duration: number): RateLimiterRedis =>
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl",
    points,
    duration,
    inMemoryBlockOnConsumed: points * 2,
    insuranceLimiter: new RateLimiterMemory({
      keyPrefix: "rl-fallback",
      points,
      duration
    })
  });

export const enforceRateLimit = async (limiter: RateLimiterRedis, key: string): Promise<void> => {
  try {
    await limiter.consume(key);
  } catch {
    throw new AppError("RATE_LIMITED", "Too many requests");
  }
};
