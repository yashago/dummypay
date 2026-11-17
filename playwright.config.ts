import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  // Tests talk to the hosted Supabase project over the network.
  expect: { timeout: 10_000 },
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // Specs share global state in the hosted project (exchange-rate fixtures) and
  // auth is rate-limited, so run one spec at a time.
  workers: 1,
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Mobile runs layout-focused specs only (full flows would double the sign-ins).
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(shell|mobile)\.spec\.ts$/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
