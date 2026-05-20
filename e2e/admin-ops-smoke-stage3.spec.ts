import { expect, test, type APIRequestContext } from "@playwright/test";

type LoginResult = { csrfToken: string };

const expectCsvExportHeaders = (
  headers: Record<string, string>,
  filenamePrefix: string
): void => {
  expect(headers["content-type"]).toContain("text/csv");
  expect(headers["content-disposition"]).toContain(filenamePrefix);

  const exportedCountRaw = headers["x-exported-count"];
  expect(exportedCountRaw).toBeTruthy();
  const exportedCount = Number(exportedCountRaw);
  expect(Number.isFinite(exportedCount)).toBeTruthy();
  expect(exportedCount).toBeGreaterThanOrEqual(0);
};

const loginByApi = async (
  request: APIRequestContext,
  creds: { email: string; password: string }
): Promise<LoginResult> => {
  const response = await request.post("/api/auth/login", {
    data: creds
  });

  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as {
    success: boolean;
    data: { csrfToken: string };
  };

  expect(payload.success).toBeTruthy();
  return { csrfToken: payload.data.csrfToken };
};

test("admin stage3 API smoke: runtime/backups/content/logs/users/products exports", async ({ request }) => {
  await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const runtimeRes = await request.get("/api/admin/settings/runtime");
  expect(runtimeRes.ok()).toBeTruthy();
  const runtimePayload = (await runtimeRes.json()) as {
    success: boolean;
    data: {
      generatedAt: string;
      checks: unknown[];
      summary: { healthy: number; warning: number; critical: number };
    };
  };
  expect(runtimePayload.success).toBeTruthy();
  expect(runtimePayload.data.checks.length).toBeGreaterThan(0);

  const backupsRes = await request.get("/api/admin/backups/health");
  expect(backupsRes.ok()).toBeTruthy();
  const backupsPayload = (await backupsRes.json()) as {
    success: boolean;
    data: {
      generatedAt: string;
      status: { databaseReachable: boolean; uploadConfigured: boolean; pitrLikelySupported: boolean };
      policyChecklist: string[];
    };
  };
  expect(backupsPayload.success).toBeTruthy();
  expect(backupsPayload.data.policyChecklist.length).toBeGreaterThan(0);

  const contentQuickRes = await request.get("/api/admin/content/quick-filters");
  expect(contentQuickRes.ok()).toBeTruthy();
  const contentQuickPayload = (await contentQuickRes.json()) as {
    success: boolean;
    data: {
      generatedAt: string;
      counts: { DRAFT: number; PUBLISHED: number; ARCHIVED: number; total: number };
    };
  };
  expect(contentQuickPayload.success).toBeTruthy();
  expect(contentQuickPayload.data.counts.total).toBeGreaterThanOrEqual(0);

  const contentExportRes = await request.get("/api/admin/content/export?limit=20");
  expect(contentExportRes.ok()).toBeTruthy();
  expectCsvExportHeaders(contentExportRes.headers(), "content_export_");

  const logsExportRes = await request.get("/api/admin/logs/export?limit=20");
  expect(logsExportRes.ok()).toBeTruthy();
  expectCsvExportHeaders(logsExportRes.headers(), "admin_logs_export_");

  const usersExportRes = await request.get("/api/admin/users/export?limit=20");
  expect(usersExportRes.ok()).toBeTruthy();
  expectCsvExportHeaders(usersExportRes.headers(), "users_export_");

  const productsExportRes = await request.get("/api/admin/products/export?limit=20&sortBy=newest");
  expect(productsExportRes.ok()).toBeTruthy();
  expectCsvExportHeaders(productsExportRes.headers(), "products_export_");
});

test("admin stage3 UI smoke: content sticky bulk bar appears and runs", async ({ page, request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const suffix = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
  const slug = `stage3-ui-${suffix}`;
  const title = `Stage3 UI ${suffix}`;

  const createPostRes = await request.post("/api/admin/content", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      slug,
      title,
      content: "E2E content to verify sticky bulk action bar behavior in admin content module.",
      status: "DRAFT"
    }
  });
  expect(createPostRes.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill("admin@example.com");
  await page.locator("input[type='password']").fill("ChangeMe123!");
  await page.locator("form button[type='submit']").click();
  await page.waitForURL("**/admin**");

  await page.goto(`/admin/content?search=${encodeURIComponent(slug)}`);
  await expect(page.getByText(title)).toBeVisible();

  await page.locator("tbody input[type='checkbox']").first().check();
  await expect(page.getByRole("button", { name: /bulk/i })).toBeVisible();

  const bulkResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/content/bulk") &&
      response.request().method() === "POST" &&
      response.status() === 200
  );

  await page.getByRole("button", { name: /bulk/i }).click();
  await bulkResponsePromise;
});
