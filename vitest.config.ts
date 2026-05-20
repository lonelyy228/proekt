import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    include: ["src/tests/**/*.spec.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    environment: "node",
    globals: true,
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://test:test@localhost:5432/testdb",
      DIRECT_URL: "postgresql://test:test@localhost:5432/testdb",
      JWT_ACCESS_SECRET: "12345678901234567890123456789012",
      JWT_REFRESH_SECRET: "12345678901234567890123456789012",
      JWT_KEY_ID: "test-key",
      REFRESH_TOKEN_PEPPER: "1234567890123456",
      ACCESS_TOKEN_TTL_SECONDS: "900",
      REFRESH_TOKEN_TTL_DAYS: "30",
      COOKIE_DOMAIN: "localhost",
      REDIS_URL: "redis://localhost:6379",
      STRIPE_SECRET_KEY: "sk_test_mock_key",
      STRIPE_WEBHOOK_SECRET: "whsec_mock_key",
      STRIPE_PRICE_CURRENCY: "usd",
      STORE_USD_TO_RUB_RATE: "90"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/server/utils/**/*.ts"]
    }
  }
});
