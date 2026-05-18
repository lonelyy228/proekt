import { test, expect, APIRequestContext } from "@playwright/test";

const loginByApi = async (
  api: APIRequestContext,
  params: { email: string; password: string }
): Promise<{ csrfToken: string }> => {
  const response = await api.post("/api/auth/login", {
    data: params
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    success: boolean;
    data: { csrfToken: string };
  };
  expect(payload.success).toBeTruthy();
  return { csrfToken: payload.data.csrfToken };
};

test("admin analytics endpoint returns typed metrics and timeline", async ({ request }) => {
  await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const response = await request.get("/api/admin/analytics?periodDays=30");
  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as {
    success: boolean;
    data: {
      period: {
        days: number;
        startDate: string;
        endDateExclusive: string;
      };
      metrics: {
        totalOrders: { current: number; previous: number; deltaPercent: number };
        paidOrders: { current: number; previous: number; deltaPercent: number };
        revenueCents: { current: number; previous: number; deltaPercent: number };
        aovCents: { current: number; previous: number; deltaPercent: number };
        paidRatePercent: { current: number; previous: number; deltaPercent: number };
        newUsers: { current: number; previous: number; deltaPercent: number };
      };
      daily: Array<{
        date: string;
        ordersCount: number;
        paidOrdersCount: number;
        revenueCents: number;
      }>;
    };
  };

  expect(payload.success).toBeTruthy();
  expect(payload.data.period.days).toBe(30);
  expect(payload.data.daily.length).toBe(30);
  expect(payload.data.metrics.totalOrders.current).toBeGreaterThanOrEqual(0);
  expect(payload.data.metrics.paidOrders.current).toBeGreaterThanOrEqual(0);
  expect(payload.data.metrics.revenueCents.current).toBeGreaterThanOrEqual(0);
  expect(payload.data.metrics.newUsers.current).toBeGreaterThanOrEqual(0);

  for (const point of payload.data.daily) {
    expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(point.ordersCount).toBeGreaterThanOrEqual(0);
    expect(point.paidOrdersCount).toBeGreaterThanOrEqual(0);
    expect(point.revenueCents).toBeGreaterThanOrEqual(0);
  }
});
