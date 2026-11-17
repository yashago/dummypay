import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

const TEST_EMAIL_SUFFIX = '@test.dummypay.dev'

/**
 * Before an integration run, delete users left behind by an interrupted
 * earlier run. Only accounts under the reserved test domain are touched.
 */
export default async function purgeStaleTestUsers() {
  // globalSetup runs in the main process, where `test.env` is not applied.
  const env = { ...loadEnv('test', process.cwd(), ''), ...process.env }
  const url = env.SUPABASE_URL
  const secret = env.SUPABASE_SECRET_KEY
  if (!url || !secret) throw new Error('Integration tests need .env.test (see README).')

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stale: string[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      if (u.email?.toLowerCase().endsWith(TEST_EMAIL_SUFFIX)) stale.push(u.id)
    }
    if (data.users.length < 1000) break
  }

  for (const id of stale) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error
  }
  if (stale.length) console.log(`[global-setup] removed ${stale.length} stale test user(s)`)
}
