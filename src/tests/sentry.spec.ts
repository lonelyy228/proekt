import { describe, expect, it } from "vitest";
import { shouldSampleMonitoringEvent } from "@/server/utils/sentry";

describe("shouldSampleMonitoringEvent", () => {
  const context = {
    requestId: "req_test_123",
    endpoint: "/api/webhooks/stripe",
    method: "POST",
    area: "webhook" as const
  };

  it("always drops when sample rate override is 0", () => {
    expect(shouldSampleMonitoringEvent("info", context, "msg", 0)).toBe(false);
  });

  it("always keeps when sample rate override is 1", () => {
    expect(shouldSampleMonitoringEvent("error", context, "msg", 1)).toBe(true);
  });

  it("is deterministic for the same fingerprint", () => {
    const first = shouldSampleMonitoringEvent("warning", context, "same-message", 0.33);
    const second = shouldSampleMonitoringEvent("warning", context, "same-message", 0.33);
    expect(first).toBe(second);
  });
});
