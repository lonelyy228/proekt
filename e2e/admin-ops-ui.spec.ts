import { test, expect } from "@playwright/test";

test("admin ops UI: sessions/webhooks/content/logs sync filters to URL", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000"
  });

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill("admin@example.com");
  await page.locator("input[type='password']").fill("ChangeMe123!");
  await page.locator("form button[type='submit']").click();

  await page.waitForURL("**/admin**");

  await page.goto("/admin/sessions");
  await page.getByPlaceholder("Поиск по email").fill("admin@example.com");
  await expect.poll(() => page.url()).toContain("search=admin%40example.com");
  await page.getByRole("button", { name: "Скопировать ссылку" }).click();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain("/admin/sessions");

  await page.goto("/admin/webhooks");
  await page.getByPlaceholder("Тип события, например checkout.session.completed").fill("checkout.session.completed");
  await expect.poll(() => page.url()).toContain("eventType=checkout.session.completed");

  await page.goto("/admin/content");
  await page.getByPlaceholder("Поиск по title/slug").fill("news");
  await expect.poll(() => page.url()).toContain("search=news");

  await page.goto("/admin/logs");
  await page.getByPlaceholder("Поиск по targetId/email").fill("admin@example.com");
  await expect.poll(() => page.url()).toContain("search=admin%40example.com");
});
