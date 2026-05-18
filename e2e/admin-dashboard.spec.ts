import { test, expect, APIRequestContext } from "@playwright/test";

const loginByApi = async (
  api: APIRequestContext,
  params: { email: string; password: string }
): Promise<void> => {
  const response = await api.post("/api/auth/login", {
    data: params
  });
  expect(response.ok()).toBeTruthy();
};

test("admin dashboard overview returns KPI and health payload", async ({ request }) => {
  await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const response = await request.get("/api/admin/dashboard/overview");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    success: boolean;
    data: {
      generatedAt: string;
      kpis: {
        totalUsers: number;
        totalProducts: number;
        totalOrders: number;
        pendingWebhookEvents: number;
      };
      health: {
        hasOrderBacklog: boolean;
        hasWebhookBacklog: boolean;
        hasBlockedUsersSpike: boolean;
      };
    };
  };

  expect(payload.success).toBeTruthy();
  expect(typeof payload.data.generatedAt).toBe("string");
  expect(payload.data.kpis.totalUsers).toBeGreaterThanOrEqual(0);
  expect(payload.data.kpis.totalProducts).toBeGreaterThanOrEqual(0);
  expect(payload.data.kpis.totalOrders).toBeGreaterThanOrEqual(0);
  expect(payload.data.kpis.pendingWebhookEvents).toBeGreaterThanOrEqual(0);
  expect(typeof payload.data.health.hasOrderBacklog).toBe("boolean");
  expect(typeof payload.data.health.hasWebhookBacklog).toBe("boolean");
  expect(typeof payload.data.health.hasBlockedUsersSpike).toBe("boolean");
});
