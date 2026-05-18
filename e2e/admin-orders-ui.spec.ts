import { test, expect } from "@playwright/test";

test("admin orders UI: debounced search syncs URL and copy link feedback works", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000"
  });

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill("admin@example.com");
  await page.locator("input[type='password']").fill("ChangeMe123!");
  await page.locator("form button[type='submit']").click();

  await page.waitForURL("**/admin**");
  await page.goto("/admin/orders");

  const stickyBar = page.locator("section > div.sticky").first();
  await expect(stickyBar).toBeVisible();

  const searchInput = page.getByPlaceholder("РџРѕРёСЃРє РїРѕ email РёР»Рё ID Р·Р°РєР°Р·Р°");
  await searchInput.fill("nike");

  await expect.poll(() => page.url()).toContain("search=nike");

  const copyButton = page.getByRole("button", { name: "Скопировать ссылку" });
  await copyButton.click();
  await expect(page.getByText("РЎСЃС‹Р»РєР° СЃ С‚РµРєСѓС‰РёРјРё С„РёР»СЊС‚СЂР°РјРё СЃРєРѕРїРёСЂРѕРІР°РЅР°")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain("search=nike");
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain("/admin/orders");
});
