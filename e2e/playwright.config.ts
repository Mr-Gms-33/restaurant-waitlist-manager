import { defineConfig } from "@playwright/test";
import path from "node:path";

const e2ePort = Number(process.env.E2E_APP_PORT ?? "18080");

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  globalSetup: path.join(__dirname, "support", "global-setup.ts"),
  globalTeardown: path.join(__dirname, "support", "global-teardown.ts"),
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`,
    headless: true,
  },
});
