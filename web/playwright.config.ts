// Stage 19: end-to-end tests. A real browser clicks through Nook like a person would.
//
//   npm run e2e                                   against the dev servers (http://localhost:3000)
//   E2E_BASE_URL=http://localhost npm run e2e     against the Docker setup, through Caddy (what CI does)
//
// Unit tests (Vitest) live in tests/; these live in e2e/.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
    launchOptions: { args: ["--no-proxy-server", "--proxy-bypass-list=*"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /phone\.spec\.ts/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /phone\.spec\.ts/ },
  ],
});
