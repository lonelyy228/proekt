import { describe, expect, it } from "vitest";
import { env, validateProductionEnv } from "@/config/env";

describe("validateProductionEnv", () => {
  it("passes for non-production environments", () => {
    expect(() => validateProductionEnv({ ...env, NODE_ENV: "test" })).not.toThrow();
  });

  it("fails when production APP_URL is not https", () => {
    expect(() =>
      validateProductionEnv({
        ...env,
        NODE_ENV: "production",
        APP_URL: "http://example.com",
        COOKIE_DOMAIN: "example.com",
        STRIPE_SECRET_KEY: "sk_live_valid_key",
        UPLOADTHING_TOKEN: "token",
        UPLOADTHING_APP_ID: "app"
      })
    ).toThrow(/APP_URL must use https in production/i);
  });

  it("fails when production cookie domain is localhost", () => {
    expect(() =>
      validateProductionEnv({
        ...env,
        NODE_ENV: "production",
        APP_URL: "https://example.com",
        COOKIE_DOMAIN: "localhost",
        STRIPE_SECRET_KEY: "sk_live_valid_key",
        UPLOADTHING_TOKEN: "token",
        UPLOADTHING_APP_ID: "app"
      })
    ).toThrow(/COOKIE_DOMAIN must not be localhost/i);
  });

  it("fails when production stripe key is not live", () => {
    expect(() =>
      validateProductionEnv({
        ...env,
        NODE_ENV: "production",
        APP_URL: "https://example.com",
        COOKIE_DOMAIN: "example.com",
        STRIPE_SECRET_KEY: "sk_test_mock",
        UPLOADTHING_TOKEN: "token",
        UPLOADTHING_APP_ID: "app"
      })
    ).toThrow(/STRIPE_SECRET_KEY must be a live key/i);
  });

  it("fails when production uploadthing credentials are missing", () => {
    expect(() =>
      validateProductionEnv({
        ...env,
        NODE_ENV: "production",
        APP_URL: "https://example.com",
        COOKIE_DOMAIN: "example.com",
        STRIPE_SECRET_KEY: "sk_live_valid_key",
        UPLOADTHING_TOKEN: undefined,
        UPLOADTHING_APP_ID: undefined
      })
    ).toThrow(/UPLOADTHING_TOKEN and UPLOADTHING_APP_ID are required/i);
  });
});
