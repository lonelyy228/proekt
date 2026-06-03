import { describe, expect, it } from "vitest";
import { isAllowedCheckoutReturnUrl } from "@/server/utils/checkout-return-url";

describe("isAllowedCheckoutReturnUrl", () => {
  it("allows the configured app origin", () => {
    expect(
      isAllowedCheckoutReturnUrl({
        url: "https://rsh.example/checkout/success",
        appUrl: "https://rsh.example",
        nodeEnv: "production"
      })
    ).toBe(true);
  });

  it("rejects foreign origins in production", () => {
    expect(
      isAllowedCheckoutReturnUrl({
        url: "https://evil.example/checkout/success",
        appUrl: "https://rsh.example",
        nodeEnv: "production"
      })
    ).toBe(false);
  });

  it("allows localhost and 127.0.0.1 parity in development on the same port", () => {
    expect(
      isAllowedCheckoutReturnUrl({
        url: "http://127.0.0.1:3000/checkout/success",
        appUrl: "http://localhost:3000",
        nodeEnv: "development"
      })
    ).toBe(true);
  });

  it("rejects unsafe protocols", () => {
    expect(
      isAllowedCheckoutReturnUrl({
        url: "javascript:alert(1)",
        appUrl: "https://rsh.example",
        nodeEnv: "production"
      })
    ).toBe(false);
  });
});
