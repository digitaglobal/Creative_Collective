import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    launchOptions: process.platform === "win32" ? { channel: "chrome" } : {},
  },
  webServer: [
    {
      command: "node tests/e2e/backend.mjs",
      url: "http://localhost:54330/health",
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --port 3001",
      url: "http://localhost:3001",
      timeout: 60_000,
      env: {
        VITE_SUPABASE_URL: "http://localhost:54330",
        VITE_SUPABASE_ANON_KEY: "fixture-public-key",
        VITE_DEMO_MODE: "false",
      },
    },
  ],
});
