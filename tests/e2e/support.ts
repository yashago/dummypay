import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

process.loadEnvFile('.env.test')

export const TEST_PASSWORD = 'Test-password-123!'

export function e2eEmail() {
  return `e2e-${randomUUID().slice(0, 12)}@test.dummypay.dev`
}

export const admin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
)

/** Creates a confirmed user via the admin API (no sign-up rate limit). */
export async function createE2EUser(displayName: string, currency: 'ILS' | 'USD' | 'EUR' | 'GBP') {
  const email = e2eEmail()
  const { error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName, preferred_currency: currency },
  })
  if (error) throw error
  return { email, displayName }
}

export async function signInViaUi(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor()
}

/** Deletes E2E users by email (test domain only). */
export async function deleteUsersByEmail(emails: string[]) {
  if (!emails.length) return
  const { data } = await admin.from('profiles').select('id, email').in('email', emails)
  for (const row of data ?? []) {
    if (row.email.endsWith('@test.dummypay.dev')) await admin.auth.admin.deleteUser(row.id)
  }
}
