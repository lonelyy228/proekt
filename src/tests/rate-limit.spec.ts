import { describe, expect, it, vi } from "vitest";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { enforceRateLimit } from "@/server/utils/rate-limit";
import { AppError } from "@/server/utils/errors";

describe("enforceRateLimit", () => {
  it("allows request when limiter consume resolves", async () => {
    const limiter = {
      consume: vi.fn().mockResolvedValue({})
    } as unknown as RateLimiterRedis;

    await expect(enforceRateLimit(limiter, "security-test-key")).resolves.toBeUndefined();
    expect(limiter.consume).toHaveBeenCalledWith("security-test-key");
  });

  it("throws RATE_LIMITED app error when limiter consume rejects", async () => {
    const limiter = {
      consume: vi.fn().mockRejectedValue(new Error("too many requests"))
    } as unknown as RateLimiterRedis;

    await expect(enforceRateLimit(limiter, "security-test-key")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many requests"
    } satisfies Partial<AppError>);
  });
});
