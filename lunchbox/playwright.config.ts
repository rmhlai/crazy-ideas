import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const DATA = "./data-e2e";
// fresh database for every run
fs.rmSync(DATA, { recursive: true, force: true });

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], browserName: "chromium" } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      LUNCHBOX_DATA_DIR: DATA,
      // parse step returns fixtures/mock/<kind>.json instead of calling the API
      LUNCHBOX_MOCK_EXTRACTION_DIR: "./fixtures/mock",
      ANTHROPIC_API_KEY: "",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
