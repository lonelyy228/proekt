import { test, expect, APIRequestContext } from "@playwright/test";
import { generateSync } from "otplib";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const createStrongPassword = (): string => "StrongPass1!";
const createEmail = (): string => `e2e_${Date.now()}_${Math.round(Math.random() * 100000)}@example.com`;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const loginByApi = async (
  api: APIRequestContext,
  params: { email: string; password: string; totpCode?: string }
): Promise<{ csrfToken: string }> => {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await api.post("/api/auth/login", {
      data: params
    });

    lastStatus = response.status();
    if (response.ok()) {
      const payload = (await response.json()) as {
        success: boolean;
        data: { csrfToken: string };
      };
      expect(payload.success).toBeTruthy();
      return { csrfToken: payload.data.csrfToken };
    }

    if (response.status() !== 429) {
      const payload = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      throw new Error(payload.error?.message ?? `Login failed with status ${response.status()}`);
    }

    await sleep(1_500 * attempt);
  }

  throw new Error(`Login rate-limited after retries, last status=${lastStatus}`);
};

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("пользователь может включить 2FA и входить с TOTP", async ({ request }) => {
  const api = request;
  const email = createEmail();
  const password = createStrongPassword();

  const register = await api.post("/api/auth/register", {
    data: { email, password }
  });
  expect(register.ok()).toBeTruthy();

  const login = await loginByApi(api, { email, password });

  const setupRes = await api.post("/api/auth/2fa/setup", {
    headers: { "x-csrf-token": login.csrfToken },
    data: {}
  });
  expect(setupRes.ok()).toBeTruthy();
  const setupPayload = (await setupRes.json()) as {
    success: boolean;
    data: { secret: string };
  };
  expect(setupPayload.success).toBeTruthy();

  const totp = generateSync({ secret: setupPayload.data.secret });

  const enableRes = await api.post("/api/auth/2fa/enable", {
    headers: { "x-csrf-token": login.csrfToken },
    data: { code: totp }
  });
  expect(enableRes.ok()).toBeTruthy();
  const enablePayload = (await enableRes.json()) as { success: boolean; data: { backupCodes: string[] } };
  expect(enablePayload.success).toBeTruthy();
  expect(enablePayload.data.backupCodes.length).toBeGreaterThan(0);

  const logoutRes = await api.post("/api/auth/logout", {
    headers: { "x-csrf-token": login.csrfToken },
    data: {}
  });
  expect(logoutRes.ok()).toBeTruthy();

  const failLoginNoTotp = await api.post("/api/auth/login", {
    data: { email, password }
  });
  expect(failLoginNoTotp.status()).toBe(401);

  let totpLoginSucceeded = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const freshTotp = generateSync({ secret: setupPayload.data.secret });
    const loginWithTotp = await api.post("/api/auth/login", {
      data: { email, password, totpCode: freshTotp }
    });

    if (loginWithTotp.ok()) {
      totpLoginSucceeded = true;
      break;
    }

    if (loginWithTotp.status() !== 401 && loginWithTotp.status() !== 429) {
      const payload = (await loginWithTotp.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      throw new Error(payload.error?.message ?? `Unexpected status ${loginWithTotp.status()} for TOTP login`);
    }

    await sleep(1_100 * attempt);
  }

  expect(totpLoginSucceeded).toBeTruthy();
});

test("endpoint статуса заказа возвращает обновления после оплаты", async ({ request }) => {
  const api = request;
  const email = createEmail();
  const password = createStrongPassword();

  const register = await api.post("/api/auth/register", {
    data: { email, password }
  });
  expect(register.ok()).toBeTruthy();

  await loginByApi(api, { email, password });

  const user = await prisma.user.findUnique({ where: { email } });
  expect(user).not.toBeNull();
  if (!user) {
    return;
  }

  const createdOrder = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PENDING",
      subtotalCents: 10000,
      shippingCents: 0,
      taxCents: 800,
      totalCents: 10800,
      currency: "USD",
      shippingAddressJson: {
        firstName: "E2E",
        lastName: "User",
        line1: "Main Street 1",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US"
      }
    }
  });

  const pendingStatusRes = await api.get(`/api/profile/orders/${createdOrder.id}/status`);
  expect(pendingStatusRes.ok()).toBeTruthy();
  const pendingPayload = (await pendingStatusRes.json()) as {
    success: boolean;
    data: { status: string };
  };
  expect(pendingPayload.success).toBeTruthy();
  expect(pendingPayload.data.status).toBe("PENDING");

  await prisma.order.update({
    where: { id: createdOrder.id },
    data: { status: "PAID" }
  });

  const paidStatusRes = await api.get(`/api/profile/orders/${createdOrder.id}/status`);
  expect(paidStatusRes.ok()).toBeTruthy();
  const paidPayload = (await paidStatusRes.json()) as {
    success: boolean;
    data: { status: string };
  };
  expect(paidPayload.success).toBeTruthy();
  expect(paidPayload.data.status).toBe("PAID");
});
