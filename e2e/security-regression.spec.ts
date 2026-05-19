import { test, expect, APIRequestContext, APIResponse } from "@playwright/test";

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
