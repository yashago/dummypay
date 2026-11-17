import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Deterministic exchange rates for tests (units per 1 USD). Chosen so results
 * are easy to verify by hand, e.g. USD→EUR = 0.9 makes 5¢ → 4.5¢ → 5¢ (half-up).
 */
export const FIXTURE_RATES = { USD: 1, ILS: 3.7, EUR: 0.9, GBP: 0.8 } as const
export const FIXTURE_PROVIDER = 'test-fixture'

type Admin = SupabaseClient<Database>
type Snapshot = {
  rates: Database['public']['Tables']['fx_rates']['Row'][]
  status: Database['public']['Tables']['fx_status']['Row'] | null
}

/**
 * The project is shared with development, so tests must not leave fake rates
 * behind: snapshot real rates first, restore them afterwards.
 */
export async function snapshotFx(admin: Admin): Promise<Snapshot> {
  const [rates, status] = await Promise.all([
    admin.from('fx_rates').select('*'),
    admin.from('fx_status').select('*').maybeSingle(),
  ])
  if (rates.error) throw rates.error
  if (status.error) throw status.error
  return { rates: rates.data, status: status.data }
}

export async function seedFixtureRates(admin: Admin, providerUpdatedAt = new Date()) {
  const { error } = await admin.rpc('ingest_fx_rates', {
    p_provider: FIXTURE_PROVIDER,
    p_provider_updated_at: providerUpdatedAt.toISOString(),
    p_rates: FIXTURE_RATES,
  })
  if (error) throw error
}

export async function restoreFx(admin: Admin, snapshot: Snapshot) {
  if (snapshot.rates.length) {
    const { error } = await admin.from('fx_rates').upsert(snapshot.rates)
    if (error) throw error
  } else {
    const { error } = await admin.from('fx_rates').delete().eq('provider', FIXTURE_PROVIDER)
    if (error) throw error
  }
  if (snapshot.status) {
    const { error } = await admin.from('fx_status').update(snapshot.status).eq('id', true)
    if (error) throw error
  }
  const { error } = await admin.from('fx_rate_history').delete().eq('provider', FIXTURE_PROVIDER)
  if (error) throw error
}
