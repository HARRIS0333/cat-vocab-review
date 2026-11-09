import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173/cat-vocab/";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
  },
  webServer: {
    command:
      "VITE_BASE_PATH=/cat-vocab/ npm run preview -- --host 127.0.0.1 --port 4173",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "iphone-portrait",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
    {
      name: "iphone-landscape",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 844, height: 390 },
        browserName: "webkit",
      },
    },
    {
      name: "ipad-portrait",
      use: {
        ...devices["iPad Pro 11"],
        viewport: { width: 834, height: 1194 },
        browserName: "webkit",
      },
    },
    {
      name: "ipad-landscape",
      use: {
        ...devices["iPad Pro 11"],
        viewport: { width: 1194, height: 834 },
        browserName: "webkit",
      },
    },
  ],
});
