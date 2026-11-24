import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100", trace: "off"},
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "npm run start -- -p 3100",
    port: 3100,
    reuseExistingServer: true,
    env: { KUMO_ALLOW_OUTBOX: "1", BETTER_AUTH_URL: "http://localhost:3100", BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-123", DATABASE_URL: process.env.DATABASE_URL ?? "postgres://kumo:kumo@localhost:5432/kumo_test" },
  },
});
