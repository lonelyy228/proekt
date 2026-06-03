import { describe, expect, it } from "vitest";
import { shouldUseLocalCheckoutFallback } from "@/server/services/checkout-service";

describe("shouldUseLocalCheckoutFallback", () => {
  it("allows local checkout fallback for placeholder development keys", () => {
    expect(
      shouldUseLocalCheckoutFallback({
        nodeEnv: "development",
        stripeSecretKey: "sk_test_xxx"
      })
    ).toBe(true);
  });

  it("allows local checkout fallback for CI mock keys", () => {
    expect(
      shouldUseLocalCheckoutFallback({
        nodeEnv: "test",
        stripeSecretKey: "sk_test_mock_key"
      })
    ).toBe(true);
  });

  it("never enables local checkout fallback in production", () => {
    expect(
      shouldUseLocalCheckoutFallback({
        nodeEnv: "production",
        stripeSecretKey: "sk_live_placeholder"
      })
    ).toBe(false);
  });

  it("uses Stripe for normal non-production test keys", () => {
    expect(
      shouldUseLocalCheckoutFallback({
        nodeEnv: "development",
        stripeSecretKey: "sk_test_51realisticKey"
      })
    ).toBe(false);
  });
});
