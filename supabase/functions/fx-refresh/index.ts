// fx-refresh — fetches current rates from ExchangeRate-API and stores them.
//
// * Callable by any signed-in user (the app calls it when rates look stale);
//   the user's JWT is verified here.
// * The provider is contacted at most once per MIN_INTERVAL across all
//   callers (atomic claim in Postgres), protecting the API quota.
// * The API key lives only in this function's environment
//   (`supabase secrets set EXCHANGERATE_API_KEY=...`).
// * On any provider failure the previous rates are kept untouched.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseExchangeRateApi, PROVIDER } from '../_shared/fx.ts'

const MIN_INTERVAL = '30 minutes'
const PROVIDER_BASE_URL = Deno.env.get('FX_API_BASE_URL') ?? 'https://v6.exchangerate-api.com/v6'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 1. Only signed-in users may trigger a refresh.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'NOT_AUTHENTICATED' }, 401)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'NOT_AUTHENTICATED' }, 401)

  // 2. Throttle: one provider call per MIN_INTERVAL, across all users.
  const { data: claimed, error: claimError } = await admin.rpc('claim_fx_refresh', {
    p_min_interval: MIN_INTERVAL,
  })
  if (claimError) return json({ error: 'INTERNAL' }, 500)
  if (!claimed) return json({ refreshed: false, reason: 'THROTTLED' })

  // 3. Fetch and validate.
  const apiKey = Deno.env.get('EXCHANGERATE_API_KEY')
  if (!apiKey) {
    await admin.rpc('record_fx_failure', { p_error: 'Exchange-rate API key is not configured' })
    return json({ refreshed: false, reason: 'NOT_CONFIGURED' }, 503)
  }

  let payload: unknown
  try {
    const res = await fetch(`${PROVIDER_BASE_URL}/${encodeURIComponent(apiKey)}/latest/USD`, {
      signal: AbortSignal.timeout(8000),
    })
    payload = await res.json()
  } catch (err) {
    const reason = err instanceof Error ? err.name : 'unknown'
    await admin.rpc('record_fx_failure', { p_error: `Provider request failed (${reason})` })
    return json({ refreshed: false, reason: 'PROVIDER_UNAVAILABLE' }, 502)
  }

  const parsed = parseExchangeRateApi(payload)
  if (!parsed.ok) {
    await admin.rpc('record_fx_failure', { p_error: `Rejected provider response: ${parsed.error}` })
    return json({ refreshed: false, reason: 'PROVIDER_INVALID' }, 502)
  }

  // 4. Store (validated again in SQL; atomic).
  const { error: ingestError } = await admin.rpc('ingest_fx_rates', {
    p_provider: PROVIDER,
    p_provider_updated_at: parsed.providerUpdatedAt,
    p_rates: parsed.rates,
  })
  if (ingestError) {
    await admin.rpc('record_fx_failure', { p_error: 'Rates failed database validation' })
    return json({ refreshed: false, reason: 'PROVIDER_INVALID' }, 502)
  }

  return json({ refreshed: true, provider_updated_at: parsed.providerUpdatedAt })
})
