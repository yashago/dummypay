import { defineConfig, devices } from '@playwright/test'

// Set E2E_BASE_URL to run against a deployment (e.g. the Vercel URL) instead
// of the local dev server.
const remoteBaseUrl = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  // One retry in CI absorbs network blips; more would multiply sign-ins
  // against the Auth rate limit.
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // Tests talk to the hosted Supabase project over the network.
  expect: { timeout: 10_000 },
  timeout: 60_000,
  use: {
    baseURL: remoteBaseUrl ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // Specs share global state in the hosted project (exchange-rate fixtures) and
  // auth is rate-limited, so run one spec at a time.
  workers: 1,
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts$/ },
    // Mobile runs layout-focused specs only (full flows would double the sign-ins).
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(shell|mobile)\.spec\.ts$/ },
  ],
  webServer: remoteBaseUrl
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
})
