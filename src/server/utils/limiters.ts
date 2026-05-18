import { createRateLimiter } from "@/server/utils/rate-limit";
import { rateLimitConfig } from "@/config/constants";

export const authLimiter = createRateLimiter(rateLimitConfig.auth.points, rateLimitConfig.auth.durationSeconds);
export const checkoutLimiter = createRateLimiter(rateLimitConfig.checkout.points, rateLimitConfig.checkout.durationSeconds);
export const adminMutationLimiter = createRateLimiter(
  rateLimitConfig.adminMutation.points,
  rateLimitConfig.adminMutation.durationSeconds
);
