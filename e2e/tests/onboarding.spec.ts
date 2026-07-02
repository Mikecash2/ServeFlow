import { test, expect } from "@playwright/test";

/**
 * docs/05-user-flows.md §1 (Church Onboarding). Not executed in this
 * sandbox — see playwright.config.ts header comment.
 */
test("a new church admin can register and land on a working dashboard", async ({ page }) => {
  const unique = Date.now();
  await page.goto("/register");

  await page.getByLabel("Church name").fill(`E2E Test Church ${unique}`);
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Admin");
  await page.getByLabel("Email").fill(`e2e-admin-${unique}@example.com`);
  await page.getByLabel("Password").fill("SuperSecret123!");
  await page.getByRole("button", { name: /create church/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(`E2E Test Church ${unique}`)).toBeVisible();
  await expect(page.getByText("CHURCH_ADMIN")).toBeVisible();

  // Log out and log back in — proves the credentials actually persisted.
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(`e2e-admin-${unique}@example.com`);
  await page.getByLabel("Password").fill("SuperSecret123!");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
