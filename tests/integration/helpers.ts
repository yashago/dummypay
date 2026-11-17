import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { CurrencyCode } from '@/lib/money'

/**
 * Integration-test helpers. Tests run against the hosted project shared with
 * development, so every test user lives under TEST_EMAIL_DOMAIN and is deleted
 * in afterAll. Auth sign-in/sign-up is rate-limited (30 / 5 min / IP), so users
 * are created through the admin API and each test file signs in only a few.
 */

export const TEST_EMAIL_DOMAIN = 'test.dummypay.dev'
export const TEST_PASSWORD = 'Test-password-123!'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}. Integration tests need .env.test (see README).`)
  return value
}

export const SUPABASE_URL = env('SUPABASE_URL')
const PUBLISHABLE_KEY = env('SUPABASE_PUBLISHABLE_KEY')
const SECRET_KEY = env('SUPABASE_SECRET_KEY')

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const

export type Client = SupabaseClient<Database>

/** Bypasses RLS. Used only for setup, verification and cleanup — never as the actor under test. */
export const admin: Client = createClient<Database>(SUPABASE_URL, SECRET_KEY, noSession)

/** A fresh unauthenticated client (role `anon`). */
export function anonClient(): Client {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, noSession)
}

export function testEmail(tag = 'it'): string {
  return `${tag}-${randomUUID().slice(0, 12)}@${TEST_EMAIL_DOMAIN}`
}

const createdUserIds = new Set<string>()

/** Register an id created outside createTestUser (e.g. via public signUp) for cleanup. */
export function trackUser(id: string) {
  createdUserIds.add(id)
}

export type TestUser = { id: string; email: string; displayName: string; currency: CurrencyCode }

/** Creates a confirmed user through the admin API; the sign-up trigger still runs. */
export async function createTestUser(
  currency: CurrencyCode,
  displayName = `Test ${currency}`,
): Promise<TestUser> {
  const email = testEmail()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName, preferred_currency: currency },
  })
  if (error) throw error
  trackUser(data.user.id)
  return { id: data.user.id, email, displayName, currency }
}

/**
 * Auth allows 30 sign-ins per 5 minutes per IP. On a 429, signInAs waits and
 * retries; these delays add up to the full 5-minute window, after which a 429
 * is a real problem and is thrown.
 */
const SIGN_IN_RETRY_DELAYS_MS = [30_000, 60_000, 90_000, 120_000]

/**
 * Timeout for any hook or test that calls signInAs: the worst-case retry wait
 * plus a minute for the work itself. Without it the default hook (60 s) and
 * test (30 s) timeouts cut the retries short and the file fails instead.
 */
export const SIGN_IN_TIMEOUT_MS = SIGN_IN_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) + 60_000

/** Signs in as the user, returning a client whose requests carry that user's JWT. */
export async function signInAs(user: { email: string }): Promise<Client> {
  const client = anonClient()
  for (let attempt = 0; ; attempt++) {
    const { error } = await client.auth.signInWithPassword({
      email: user.email,
      password: TEST_PASSWORD,
    })
    if (!error) return client
    const delay = SIGN_IN_RETRY_DELAYS_MS[attempt]
    if (error.status !== 429 || delay === undefined) throw error
    console.warn(`[signInAs] Auth rate limit (429); retrying in ${delay / 1000}s`)
    await new Promise((r) => setTimeout(r, delay))
  }
}

export async function deleteTrackedUsers() {
  const ids = [...createdUserIds]
  createdUserIds.clear()
  const results = await Promise.allSettled(ids.map((id) => admin.auth.admin.deleteUser(id)))
  const failures = results.filter(
    (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error),
  )
  if (failures.length) {
    throw new Error(`Failed to delete ${failures.length} test user(s): ${JSON.stringify(failures)}`)
  }
}
