import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const createStrongPassword = (): string => "StrongPass1!";
const createEmail = (prefix: string): string => `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}@example.com`;

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

test("admin bulk revoke sessions: dry-run and execute", async ({ request, baseURL }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const email = createEmail("bulk_sessions");
  const password = createStrongPassword();

  const registerRes = await request.post("/api/auth/register", {
    data: { email, password }
  });
  expect(registerRes.ok()).toBeTruthy();

  if (!baseURL) {
    throw new Error("baseURL is not configured for e2e run");
  }

  const userApi1 = await playwrightRequest.newContext({ baseURL });
  const userApi2 = await playwrightRequest.newContext({ baseURL });

  await loginByApi(userApi1, { email, password });
  await loginByApi(userApi2, { email, password });

  const user = await prisma.user.findUnique({ where: { email } });
  expect(user).not.toBeNull();
  if (!user) {
    await userApi1.dispose();
    await userApi2.dispose();
    return;
  }

  const activeBefore = await prisma.session.count({
    where: {
      userId: user.id,
      status: "ACTIVE"
    }
  });
  expect(activeBefore).toBeGreaterThanOrEqual(2);

  const dryRunRes = await request.post("/api/admin/sessions/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      userId: user.id,
      status: "ACTIVE",
      limit: 200,
      dryRun: true
    }
  });
  expect(dryRunRes.ok()).toBeTruthy();

  const dryRunPayload = (await dryRunRes.json()) as {
    success: boolean;
    data: { dryRun: boolean; matchedCount: number; revokedCount: number };
  };
  expect(dryRunPayload.success).toBeTruthy();
  expect(dryRunPayload.data.dryRun).toBeTruthy();
  expect(dryRunPayload.data.revokedCount).toBe(0);
  expect(dryRunPayload.data.matchedCount).toBeGreaterThanOrEqual(2);

  const executeRes = await request.post("/api/admin/sessions/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      userId: user.id,
      status: "ACTIVE",
      limit: 200,
      dryRun: false
    }
  });
  expect(executeRes.ok()).toBeTruthy();

  const executePayload = (await executeRes.json()) as {
    success: boolean;
    data: { dryRun: boolean; matchedCount: number; revokedCount: number };
  };
  expect(executePayload.success).toBeTruthy();
  expect(executePayload.data.dryRun).toBeFalsy();
  expect(executePayload.data.revokedCount).toBeGreaterThanOrEqual(2);

  const meAfterRevoke1 = await userApi1.get("/api/auth/me");
  const meAfterRevoke2 = await userApi2.get("/api/auth/me");
  expect(meAfterRevoke1.status()).toBe(401);
  expect(meAfterRevoke2.status()).toBe(401);

  await userApi1.dispose();
  await userApi2.dispose();
});

test("admin webhook bulk dry-run has no side effects", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const eventType = `test.bulk.dryrun.${Date.now()}`;

  await prisma.stripeEventLog.createMany({
    data: [
      {
        eventId: `evt_bulk_${Date.now()}_1`,
        eventType,
        payload: {
          id: `evt_bulk_${Date.now()}_1`,
          type: eventType,
          object: "event",
          data: { object: {} }
        }
      },
      {
        eventId: `evt_bulk_${Date.now()}_2`,
        eventType,
        payload: {
          id: `evt_bulk_${Date.now()}_2`,
          type: eventType,
          object: "event",
          data: { object: {} }
        }
      }
    ]
  });

  const dryRunRes = await request.post("/api/admin/webhooks/stripe/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      eventType,
      processed: false,
      limit: 10,
      dryRun: true
    }
  });

  expect(dryRunRes.ok()).toBeTruthy();

  const dryRunPayload = (await dryRunRes.json()) as {
    success: boolean;
    data: { dryRun: boolean; matchedCount: number; replayedCount: number };
  };

  expect(dryRunPayload.success).toBeTruthy();
  expect(dryRunPayload.data.dryRun).toBeTruthy();
  expect(dryRunPayload.data.matchedCount).toBe(2);
  expect(dryRunPayload.data.replayedCount).toBe(0);

  const unchangedEvents = await prisma.stripeEventLog.count({
    where: {
      eventType,
      processedAt: null
    }
  });

  expect(unchangedEvents).toBe(2);
});
