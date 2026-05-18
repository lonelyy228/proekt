import { test, expect, APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("admin sessions/webhooks presets CRUD", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 100000)}`;
  const sessionPresetA = `sessions_${uniqueSuffix}_a`;
  const sessionPresetB = `sessions_${uniqueSuffix}_b`;
  const webhookPresetA = `webhooks_${uniqueSuffix}_a`;

  const createSessionA = await request.post("/api/admin/sessions/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: sessionPresetA,
      filters: {
        search: "admin@example.com",
        status: "ACTIVE"
      },
      isDefault: true
    }
  });
  expect(createSessionA.ok()).toBeTruthy();
  const sessionAData = (await createSessionA.json()) as {
    success: boolean;
    data: { id: string; filters: { search?: string; status?: string }; isDefault: boolean };
  };
  expect(sessionAData.success).toBeTruthy();
  expect(sessionAData.data.filters.search).toBe("admin@example.com");
  expect(sessionAData.data.isDefault).toBeTruthy();

  const createSessionB = await request.post("/api/admin/sessions/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: sessionPresetB,
      filters: {
        status: "REVOKED"
      },
      isDefault: true
    }
  });
  expect(createSessionB.ok()).toBeTruthy();

  const listSessionsRes = await request.get("/api/admin/sessions/presets");
  expect(listSessionsRes.ok()).toBeTruthy();
  const listSessionsPayload = (await listSessionsRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string; isDefault: boolean }>;
  };
  expect(listSessionsPayload.success).toBeTruthy();
  const scopedSessions = listSessionsPayload.data.filter((item) => item.name.startsWith(`sessions_${uniqueSuffix}`));
  expect(scopedSessions.length).toBe(2);
  expect(scopedSessions.filter((item) => item.isDefault).length).toBe(1);

  const updateSessionA = await request.patch(
    `/api/admin/sessions/presets/${encodeURIComponent(sessionAData.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      },
      data: {
        name: `${sessionPresetA}_updated`,
        filters: {
          search: "ops@example.com",
          status: "EXPIRED"
        }
      }
    }
  );
  expect(updateSessionA.ok()).toBeTruthy();

  const deleteSessionA = await request.delete(
    `/api/admin/sessions/presets/${encodeURIComponent(sessionAData.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      }
    }
  );
  expect(deleteSessionA.ok()).toBeTruthy();

  const createWebhookA = await request.post("/api/admin/webhooks/stripe/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: webhookPresetA,
      filters: {
        eventType: "checkout.session.completed",
        processed: false
      },
      isDefault: true
    }
  });
  expect(createWebhookA.ok()).toBeTruthy();
  const webhookAData = (await createWebhookA.json()) as {
    success: boolean;
    data: { id: string; filters: { eventType?: string; processed?: boolean } };
  };
  expect(webhookAData.success).toBeTruthy();
  expect(webhookAData.data.filters.eventType).toBe("checkout.session.completed");
  expect(webhookAData.data.filters.processed).toBeFalsy();

  const updateWebhookA = await request.patch(
    `/api/admin/webhooks/stripe/presets/${encodeURIComponent(webhookAData.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      },
      data: {
        filters: {
          eventType: "payment_intent.succeeded",
          processed: true
        }
      }
    }
  );
  expect(updateWebhookA.ok()).toBeTruthy();

  const listWebhooksRes = await request.get("/api/admin/webhooks/stripe/presets");
  expect(listWebhooksRes.ok()).toBeTruthy();
  const listWebhooksPayload = (await listWebhooksRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string }>;
  };
  expect(listWebhooksPayload.success).toBeTruthy();
  expect(listWebhooksPayload.data.some((item) => item.id === webhookAData.data.id)).toBeTruthy();

  const deleteWebhookA = await request.delete(
    `/api/admin/webhooks/stripe/presets/${encodeURIComponent(webhookAData.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      }
    }
  );
  expect(deleteWebhookA.ok()).toBeTruthy();

  const sessionPresetAuditCount = await prisma.adminAction.count({
    where: {
      action: {
        in: ["SESSION_FILTER_PRESET_CREATE", "SESSION_FILTER_PRESET_UPDATE", "SESSION_FILTER_PRESET_DELETE"]
      },
      targetType: "SESSION_FILTER_PRESET"
    }
  });
  expect(sessionPresetAuditCount).toBeGreaterThan(0);

  const webhookPresetAuditCount = await prisma.adminAction.count({
    where: {
      action: {
        in: ["WEBHOOK_FILTER_PRESET_CREATE", "WEBHOOK_FILTER_PRESET_UPDATE", "WEBHOOK_FILTER_PRESET_DELETE"]
      },
      targetType: "WEBHOOK_FILTER_PRESET"
    }
  });
  expect(webhookPresetAuditCount).toBeGreaterThan(0);
});
