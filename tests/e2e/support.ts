import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile('.env.test')

export const TEST_PASSWORD = 'Test-password-123!'

export function e2eEmail() {
  return `e2e-${randomUUID().slice(0, 12)}@test.dummypay.dev`
}

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Deletes E2E users by email (test domain only). */
export async function deleteUsersByEmail(emails: string[]) {
  if (!emails.length) return
  const { data } = await admin.from('profiles').select('id, email').in('email', emails)
  for (const row of data ?? []) {
    if (row.email.endsWith('@test.dummypay.dev')) await admin.auth.admin.deleteUser(row.id)
  }
}
