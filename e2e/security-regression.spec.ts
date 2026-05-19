import { test, expect, APIRequestContext, APIResponse } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const createStrongPassword = (): string => "StrongPass1!";
const createEmail = (): string => `e2e_security_${Date.now()}_${Math.round(Math.random() * 100000)}@example.com`;

const parseJson = async <T>(response: APIResponse): Promise<T> => (await response.json()) as T;

const loginByApi = async (
  api: APIRequestContext,
  params: { email: string; password: string }
): Promise<{ csrfToken: string; response: APIResponse }> => {
  const response = await api.post("/api/auth/login", {
    data: params
  });

  expect(response.ok()).toBeTruthy();

  const payload = await parseJson<{
    success: boolean;
    data: { csrfToken: string };
  }>(response);

  expect(payload.success).toBeTruthy();

  return {
    csrfToken: payload.data.csrfToken,
    response
  };
};

const getSetCookieHeaders = (response: APIResponse): string[] =>
  response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value);

const extractCookieValue = (setCookieHeader: string | undefined): string | null => {
  if (!setCookieHeader) {
    return null;
  }

  const [pair] = setCookieHeader.split(";");
  if (!pair) {
    return null;
  }

  const separatorIndex = pair.indexOf("=");
  if (separatorIndex < 0) {
    return null;
  }

  return pair.slice(separatorIndex + 1);
};

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("security regression: cookie flags + csrf guard + rbac guard", async ({ request }) => {
  const email = createEmail();
  const password = createStrongPassword();

  const registerRes = await request.post("/api/auth/register", {
    data: { email, password }
  });
  expect(registerRes.ok()).toBeTruthy();

  const login = await loginByApi(request, { email, password });

  const setCookieHeaders = getSetCookieHeaders(login.response);
  expect(setCookieHeaders.length).toBeGreaterThanOrEqual(3);

  const accessCookie = setCookieHeaders.find((value) => value.startsWith("access_token="));
  const refreshCookie = setCookieHeaders.find((value) => value.startsWith("refresh_token="));
  const csrfCookie = setCookieHeaders.find((value) => value.startsWith("csrf_token="));

  expect(accessCookie).toBeDefined();
  expect(refreshCookie).toBeDefined();
  expect(csrfCookie).toBeDefined();

  const accessCookieLower = accessCookie?.toLowerCase();
  const refreshCookieLower = refreshCookie?.toLowerCase();
  const csrfCookieLower = csrfCookie?.toLowerCase();

  expect(accessCookieLower).toContain("httponly");
  expect(accessCookieLower).toContain("samesite=strict");
  expect(accessCookieLower).toContain("path=/");

  expect(refreshCookieLower).toContain("httponly");
  expect(refreshCookieLower).toContain("samesite=strict");
  expect(refreshCookieLower).toContain("path=/api/auth/refresh");

  expect(csrfCookieLower).toContain("httponly");
  expect(csrfCookieLower).toContain("samesite=strict");
  expect(csrfCookieLower).toContain("path=/");

  const logoutWithoutCsrf = await request.post("/api/auth/logout", {
    data: {}
  });
  expect(logoutWithoutCsrf.status()).toBe(401);

  const logoutWithoutCsrfPayload = await parseJson<{
    success: boolean;
    error: { code: string };
  }>(logoutWithoutCsrf);
  expect(logoutWithoutCsrfPayload.success).toBeFalsy();
  expect(logoutWithoutCsrfPayload.error.code).toBe("AUTH_ERROR");

  const adminUsersAsRegularUser = await request.get("/api/admin/users?page=1&pageSize=5");
  expect(adminUsersAsRegularUser.status()).toBe(403);

  const adminUsersPayload = await parseJson<{
    success: boolean;
    error: { code: string };
  }>(adminUsersAsRegularUser);
  expect(adminUsersPayload.success).toBeFalsy();
  expect(adminUsersPayload.error.code).toBe("FORBIDDEN");
});

test("security regression: admin mutation requires csrf even for admin session", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const usersList = await request.get("/api/admin/users?page=1&pageSize=5");
  expect(usersList.ok()).toBeTruthy();

  const usersListPayload = await parseJson<{
    success: boolean;
    data: { items: Array<{ id: string }> };
  }>(usersList);
  expect(usersListPayload.success).toBeTruthy();
  expect(usersListPayload.data.items.length).toBeGreaterThan(0);

  const targetUserId = usersListPayload.data.items[0]?.id;
  expect(targetUserId).toBeTruthy();

  const mutationWithoutCsrf = await request.post("/api/admin/users/bulk", {
    data: {
      userIds: [targetUserId],
      operation: "UNBLOCK",
      dryRun: true
    }
  });
  expect(mutationWithoutCsrf.status()).toBe(401);

  const mutationWithoutCsrfPayload = await parseJson<{
    success: boolean;
    error: { code: string };
  }>(mutationWithoutCsrf);
  expect(mutationWithoutCsrfPayload.success).toBeFalsy();
  expect(mutationWithoutCsrfPayload.error.code).toBe("AUTH_ERROR");

  const mutationWithCsrf = await request.post("/api/admin/users/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      userIds: [targetUserId],
      operation: "UNBLOCK",
      dryRun: true
    }
  });
  expect(mutationWithCsrf.ok()).toBeTruthy();
});

test("security regression: admin products bulk mutation enforces csrf", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const productsList = await request.get("/api/admin/products?page=1&pageSize=5");
  expect(productsList.ok()).toBeTruthy();

  const productsListPayload = await parseJson<{
    success: boolean;
    data: { items: Array<{ id: string }> };
  }>(productsList);
  expect(productsListPayload.success).toBeTruthy();
  expect(productsListPayload.data.items.length).toBeGreaterThan(0);

  const targetProductId = productsListPayload.data.items[0]?.id;
  expect(targetProductId).toBeTruthy();

  const withoutCsrf = await request.post("/api/admin/products/bulk", {
    data: {
      productIds: [targetProductId],
      status: "ARCHIVED",
      dryRun: true
    }
  });
  expect(withoutCsrf.status()).toBe(401);

  const withoutCsrfPayload = await parseJson<{
    success: boolean;
    error: { code: string };
  }>(withoutCsrf);
  expect(withoutCsrfPayload.success).toBeFalsy();
  expect(withoutCsrfPayload.error.code).toBe("AUTH_ERROR");

  const withCsrf = await request.post("/api/admin/products/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      productIds: [targetProductId],
      status: "ARCHIVED",
      dryRun: true
    }
  });
  expect(withCsrf.ok()).toBeTruthy();
});

test("security regression: admin content presets mutation enforces csrf", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const presetName = `security_content_${Date.now()}_${Math.round(Math.random() * 100000)}`;

  const withoutCsrf = await request.post("/api/admin/content/presets", {
    data: {
      name: presetName,
      filters: {
        search: "security-check"
      },
      isDefault: false
    }
  });
  expect(withoutCsrf.status()).toBe(401);

  const withoutCsrfPayload = await parseJson<{
    success: boolean;
    error: { code: string };
  }>(withoutCsrf);
  expect(withoutCsrfPayload.success).toBeFalsy();
  expect(withoutCsrfPayload.error.code).toBe("AUTH_ERROR");

  const withCsrf = await request.post("/api/admin/content/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: presetName,
      filters: {
        search: "security-check"
      },
      isDefault: false
    }
  });
  expect(withCsrf.ok()).toBeTruthy();

  const withCsrfPayload = await parseJson<{
    success: boolean;
    data: { id: string };
  }>(withCsrf);
  expect(withCsrfPayload.success).toBeTruthy();

  const cleanup = await request.delete(
    `/api/admin/content/presets/${encodeURIComponent(withCsrfPayload.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      }
    }
  );
  expect(cleanup.ok()).toBeTruthy();
});

test("security regression: admin orders bulk mutation enforces csrf", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
    select: { id: true }
  });
  expect(adminUser).not.toBeNull();
  if (!adminUser) {
    return;
  }

  const createdOrder = await prisma.order.create({
    data: {
      userId: adminUser.id,
      status: "PENDING",
      subtotalCents: 10000,
      shippingCents: 0,
      taxCents: 800,
      totalCents: 10800,
      currency: "USD",
      shippingAddressJson: {
        firstName: "Admin",
        lastName: "Security",
        line1: "Test Street 1",
        city: "Moscow",
        state: "MOW",
        postalCode: "101000",
        country: "RU"
      }
    }
  });

  const withoutCsrf = await request.post("/api/admin/orders/bulk", {
    data: {
      orderIds: [createdOrder.id],
      status: "PAID",
      dryRun: true
    }
  });
  expect(withoutCsrf.status()).toBe(401);

  const withoutCsrfPayload = await parseJson<{
    success: boolean;
    error: { code: string };
  }>(withoutCsrf);
  expect(withoutCsrfPayload.success).toBeFalsy();
  expect(withoutCsrfPayload.error.code).toBe("AUTH_ERROR");

  const withCsrf = await request.post("/api/admin/orders/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      orderIds: [createdOrder.id],
      status: "PAID",
      dryRun: true
    }
  });
  expect(withCsrf.ok()).toBeTruthy();
});

test("security regression: admin webhooks bulk mutation enforces csrf", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const withoutCsrf = await request.post("/api/admin/webhooks/stripe/bulk", {
    data: {
      limit: 5,
      dryRun: true
    }
  });
  expect(withoutCsrf.status()).toBe(401);

  const withoutCsrfPayload = await parseJson<{
    success: boolean;
    error: { code: string };
  }>(withoutCsrf);
  expect(withoutCsrfPayload.success).toBeFalsy();
  expect(withoutCsrfPayload.error.code).toBe("AUTH_ERROR");

  const withCsrf = await request.post("/api/admin/webhooks/stripe/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      limit: 5,
      dryRun: true
    }
  });
  expect(withCsrf.ok()).toBeTruthy();
});

test("security regression: refresh rotation and logout cookie invalidation", async ({ request }) => {
  const refreshWithoutCookie = await request.post("/api/auth/refresh", {
    data: {}
  });
  expect(refreshWithoutCookie.status()).toBe(401);

  const refreshWithoutCookiePayload = await parseJson<{
    success: boolean;
    error: { code: string };
  }>(refreshWithoutCookie);
  expect(refreshWithoutCookiePayload.success).toBeFalsy();
  expect(refreshWithoutCookiePayload.error.code).toBe("AUTH_ERROR");

  const email = createEmail();
  const password = createStrongPassword();

  const registerRes = await request.post("/api/auth/register", {
    data: { email, password }
  });
  expect(registerRes.ok()).toBeTruthy();

  const login = await loginByApi(request, { email, password });
  const loginSetCookies = getSetCookieHeaders(login.response);
  const loginRefreshCookie = loginSetCookies.find((value) => value.startsWith("refresh_token="));
  const loginRefreshTokenValue = extractCookieValue(loginRefreshCookie);
  expect(loginRefreshTokenValue).toBeTruthy();

  await new Promise((resolve) => {
    setTimeout(resolve, 1100);
  });

  const refreshRes = await request.post("/api/auth/refresh", {
    data: {}
  });
  expect(refreshRes.ok()).toBeTruthy();

  const refreshPayload = await parseJson<{
    success: boolean;
    data: { csrfToken: string };
  }>(refreshRes);
  expect(refreshPayload.success).toBeTruthy();
  expect(refreshPayload.data.csrfToken).toBeTruthy();
  expect(refreshPayload.data.csrfToken).not.toBe(login.csrfToken);

  const refreshSetCookies = getSetCookieHeaders(refreshRes);
  const rotatedRefreshCookie = refreshSetCookies.find((value) => value.startsWith("refresh_token="));
  const rotatedRefreshTokenValue = extractCookieValue(rotatedRefreshCookie);
  expect(rotatedRefreshTokenValue).toBeTruthy();
  expect(rotatedRefreshTokenValue).not.toBe(loginRefreshTokenValue);

  const meBeforeLogout = await request.get("/api/auth/me");
  expect(meBeforeLogout.ok()).toBeTruthy();

  const logoutRes = await request.post("/api/auth/logout", {
    headers: {
      "x-csrf-token": refreshPayload.data.csrfToken
    },
    data: {}
  });
  expect(logoutRes.ok()).toBeTruthy();

  const logoutSetCookies = getSetCookieHeaders(logoutRes).map((value) => value.toLowerCase());
  const clearedAccessCookie = logoutSetCookies.find((value) => value.startsWith("access_token="));
  const clearedRefreshCookie = logoutSetCookies.find((value) => value.startsWith("refresh_token="));
  const clearedCsrfCookie = logoutSetCookies.find((value) => value.startsWith("csrf_token="));

  expect(clearedAccessCookie).toContain("expires=thu, 01 jan 1970");
  expect(clearedRefreshCookie).toContain("expires=thu, 01 jan 1970");
  expect(clearedCsrfCookie).toContain("expires=thu, 01 jan 1970");

  const meAfterLogout = await request.get("/api/auth/me");
  expect(meAfterLogout.status()).toBe(401);
});
