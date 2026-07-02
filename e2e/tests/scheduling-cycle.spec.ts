import { test, expect } from "@playwright/test";

/**
 * docs/05-user-flows.md §2 (Weekly Scheduling Cycle): a leader creates a
 * ministry and a service, rosters a volunteer, generates a schedule, and
 * can see + explain the resulting assignment. Not executed in this sandbox
 * — see playwright.config.ts header comment.
 */
test("a leader can build Production, roster a volunteer, and generate an explainable schedule", async ({ page }) => {
  const unique = Date.now();
  const email = `e2e-leader-${unique}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Church name").fill(`E2E Scheduling Church ${unique}`);
  await page.getByLabel("First name").fill("Lena");
  await page.getByLabel("Last name").fill("Leader");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("SuperSecret123!");
  await page.getByRole("button", { name: /create church/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Create the Production ministry.
  await page.getByRole("link", { name: "Ministries" }).click();
  await page.getByLabel("Name").fill("Production");
  await page.getByLabel("Category").selectOption("PRODUCTION");
  await page.getByRole("button", { name: /add ministry/i }).click();
  await expect(page.getByText("Production").first()).toBeVisible();

  // Invite a volunteer.
  await page.getByRole("link", { name: "Volunteers" }).click();
  await page.getByLabel("First name").fill("Dave");
  await page.getByLabel("Last name").fill("Operator");
  await page.getByLabel("Email").fill(`e2e-dave-${unique}@example.com`);
  await page.getByRole("button", { name: /invite volunteer/i }).click();
  await expect(page.getByText("Dave Operator")).toBeVisible();
  await page.getByText("Dave Operator").click();

  // Add a matching skill so the volunteer is eligible for the role below.
  await page.getByLabel("Skill name").fill("Camera Operation");
  await page.getByLabel("Experience level (1-5)").fill("3");
  await page.getByRole("button", { name: /add skill/i }).click();
  await expect(page.getByText("Camera Operation — level 3/5")).toBeVisible();

  // Submit availability for the target service date.
  await page.getByLabel("Date").fill("2026-08-02");
  await page.getByLabel("Status").selectOption("AVAILABLE");
  await page.getByRole("button", { name: /submit availability/i }).click();

  // Create a service with a role requiring that skill.
  await page.getByRole("link", { name: "Services" }).click();
  await page.getByLabel("Title").fill("E2E Sunday Service");
  await page.getByLabel("Date").fill("2026-08-02T09:00");
  await page.getByLabel("Service start").fill("2026-08-02T09:30");
  await page.getByRole("button", { name: /create service/i }).click();
  await page.getByText("E2E Sunday Service").click();

  await page.getByLabel("Role name").fill("Camera 2");
  await page.getByRole("button", { name: /add role/i }).click();
  await expect(page.getByText(/Camera 2 — 1-1 needed/)).toBeVisible();

  // Generate the schedule and confirm a real assignment with an explanation.
  await page.getByRole("button", { name: /generate schedule/i }).click();
  await expect(page.getByText(/Coverage: 100%/)).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Why?" }).click();
  await expect(page.getByText(/was assigned because/)).toBeVisible();

  // Attendance roster should now list the assigned volunteer.
  await expect(page.getByText("Dave Operator")).toBeVisible();
});
