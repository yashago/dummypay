/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Windows: VS Code terminals report the cwd as `c:\...` while Node resolves packages
// as `C:\...`; mixed casing makes Vitest load two copies of itself (broken `expect`).
// Normalising the drive letter keeps every resolved path consistent. The npm test
// scripts go through scripts/vitest.mjs, which also starts Vitest from the normalised cwd.
const root = import.meta.dirname.replace(/^[a-z]:/, (d) => d.toUpperCase())
const alias = { '@': path.resolve(root, './src') }

// https://vite.dev/config/
export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: { alias },
  // Pre-transform the app on server start so the first page load isn't slow.
  server: { warmup: { clientFiles: ['./src/main.tsx'] } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['./tests/unit/setup.ts'],
        },
      },
      {
        root,
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          include: ['tests/integration/**/*.test.ts'],
          // Loads .env + .env.test (all keys, not only VITE_*) for the test process only.
          env: loadEnv('test', root, ''),
          globalSetup: ['./tests/integration/global-setup.ts'],
          // Integration tests share one local Supabase database.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
