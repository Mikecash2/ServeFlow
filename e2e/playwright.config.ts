import { defineConfig } from "@playwright/test";

/**
 * E2E suite (docs/08-roadmap.md Phase 11) against a running preview stack —
 * both apps/web (Next.js) and apps/api (NestJS) must already be running,
 * same as the folder-structure doc's "e2e/ # Playwright tests against a
 * running preview stack" describes. Not started automatically via
 * `webServer` here because that would also require a real Postgres running
 * with the schema applied, which is environment-specific setup better done
 * explicitly before `npm run test:e2e` than implicitly by Playwright.
 *
 * NOTE: this sandbox cannot download a Playwright browser binary
 * (cdn.playwright.dev is not on the network allowlist — same class of
 * constraint as binaries.prisma.sh and cdn.playwright.dev for Chrome for
 * Testing). These tests are written and typecheck cleanly but have not
 * been executed in this environment. Run `npx playwright install chromium`
 * once on a machine with normal network access, then `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // tests share a Postgres instance; avoid cross-test data races
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
