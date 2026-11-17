import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FIXTURE_RATES, restoreFx, seedFixtureRates, snapshotFx } from '../fixtures/fx'
import {
  admin,
  anonClient,
  createTestUser,
  deleteTrackedUsers,
  signInAs,
  type Client,
  type TestUser,
} from './helpers'

let snapshot: Awaited<ReturnType<typeof snapshotFx>>
let user: TestUser
let asUser: Client

beforeAll(async () => {
  snapshot = await snapshotFx(admin)
  await seedFixtureRates(admin)
  user = await createTestUser('ILS', 'Fx Tester')
  asUser = await signInAs(user)
})

afterAll(async () => {
  await restoreFx(admin, snapshot)
  await deleteTrackedUsers()
})

async function walletsOf(userId: string) {
  const { data, error } = await admin.from('wallets').select('*').eq('user_id', userId).order('created_at')
  if (error) throw error
  return data
}

async function preview(
  client: Client,
  amount: number,
  from: 'ILS' | 'USD' | 'EUR' | 'GBP',
  to: 'ILS' | 'USD' | 'EUR' | 'GBP',
  side: 'send' | 'receive' = 'send',
) {
  return client
    .rpc('preview_conversion', { p_amount_minor: amount, p_from: from, p_to: to, p_side: side })
    .single()
}

// ---------------------------------------------------------------------------
describe('Exchange-rate ingestion (fx-refresh → ingest_fx_rates)', () => {
  it('is callable only by the service role', async () => {
    const { error } = await asUser.rpc('ingest_fx_rates', {
      p_provider: 'attacker',
      p_provider_updated_at: new Date().toISOString(),
      p_rates: { USD: 1, ILS: 0.0001, EUR: 1, GBP: 1 },
    })
    expect(error?.code).toBe('42501')
    for (const fn of ['claim_fx_refresh', 'record_fx_failure'] as const) {
      const res = await asUser.rpc(fn as never, {} as never)
      expect(res.error).not.toBeNull()
    }
  })

  it.each([
    ['a missing currency', { USD: 1, ILS: 3.7, EUR: 0.9 }, /missing rate for GBP/],
    ['a negative rate', { USD: 1, ILS: -3.7, EUR: 0.9, GBP: 0.8 }, /out of range for ILS/],
    ['a zero rate', { USD: 1, ILS: 3.7, EUR: 0, GBP: 0.8 }, /out of range for EUR/],
    ['a non-numeric rate', { USD: 1, ILS: '3.7', EUR: 0.9, GBP: 0.8 }, /missing rate for ILS/],
    ['a non-USD base', { USD: 2, ILS: 3.7, EUR: 0.9, GBP: 0.8 }, /USD base rate must be 1/],
  ])('rejects a snapshot with %s and keeps existing rates', async (_label, rates, message) => {
    const { error } = await admin.rpc('ingest_fx_rates', {
      p_provider: 'bad',
      p_provider_updated_at: new Date().toISOString(),
      p_rates: rates,
    })
    expect(error?.message).toMatch(message)
    const { data } = await admin.from('fx_rates').select('currency, units_per_usd').eq('currency', 'ILS').single()
    expect(data!.units_per_usd).toBe(FIXTURE_RATES.ILS)
  })

  it('rejects a provider timestamp in the future', async () => {
    const { error } = await admin.rpc('ingest_fx_rates', {
      p_provider: 'bad',
      p_provider_updated_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_rates: FIXTURE_RATES,
    })
    expect(error?.message).toMatch(/bad provider timestamp/)
  })

  it('throttles provider refreshes atomically', async () => {
    const first = await admin.rpc('claim_fx_refresh', { p_min_interval: '1 hour' })
    const second = await admin.rpc('claim_fx_refresh', { p_min_interval: '1 hour' })
    expect([first.data, second.data].filter(Boolean).length).toBeLessThanOrEqual(1)
    expect(second.data).toBeFalsy()
  })
})

// ---------------------------------------------------------------------------
describe('Rates display', () => {
  it('signed-in users can read derived cross rates', async () => {
    const { data, error } = await asUser
      .from('fx_cross_rates')
      .select('from_currency, to_currency, rate, provider_updated_at')
    expect(error).toBeNull()
    expect(data).toHaveLength(12) // 4 currencies × 3 others
    const ilsUsd = data!.find((r) => r.from_currency === 'ILS' && r.to_currency === 'USD')
    expect(ilsUsd!.rate).toBe(0.2702702703) // 1 / 3.7, 10 dp
    expect(ilsUsd!.provider_updated_at).toBeTruthy()
  })

  it('anonymous visitors cannot read rates or history', async () => {
    const anon = anonClient()
    for (const table of ['fx_rates', 'fx_cross_rates', 'fx_rate_history'] as const) {
      const { data } = await anon.from(table as 'fx_rates').select('*')
      expect(data ?? []).toEqual([])
    }
    const { data: history } = await asUser.from('fx_rate_history').select('*')
    expect(history ?? []).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('Conversion preview (server-side maths)', () => {
  it('converts the sending side: ₪100 → $27.03', async () => {
    const { data, error } = await preview(asUser, 10_000, 'ILS', 'USD', 'send')
    expect(error).toBeNull()
    expect(data).toMatchObject({
      sending_currency: 'ILS',
      receiving_currency: 'USD',
      sending_amount_minor: 10_000,
      receiving_amount_minor: 2_703, // 10000 × 0.2702702703 = 2702.70 → 2703
      rate: 0.2702702703,
    })
  })

  it('converts the receiving side: recipient gets $100 → sender pays ₪370.00', async () => {
    const { data } = await preview(asUser, 10_000, 'ILS', 'USD', 'receive')
    expect(data).toMatchObject({ sending_amount_minor: 37_000, receiving_amount_minor: 10_000 })
  })

  it('rounds half-up (5¢ × 0.9 = 4.5¢ → 5¢)', async () => {
    const { data } = await preview(asUser, 5, 'USD', 'EUR', 'send')
    expect(data).toMatchObject({ receiving_amount_minor: 5, rate: 0.9 })
  })

  it('uses a rate of exactly 1 for same-currency conversions', async () => {
    const { data } = await preview(asUser, 12_345, 'EUR', 'EUR', 'send')
    expect(data).toMatchObject({ receiving_amount_minor: 12_345, rate: 1 })
  })

  it.each([
    ['zero', 0],
    ['negative', -100],
    ['above the 1,000,000.00 limit', 100_000_001],
  ])('rejects a %s amount', async (_label, amount) => {
    const { error } = await preview(asUser, amount, 'USD', 'EUR')
    expect(error?.message).toMatch(/^INVALID_AMOUNT/)
  })

  it('rejects amounts that convert to less than one minor unit', async () => {
    const { error } = await preview(asUser, 1, 'ILS', 'USD') // 0.27¢ → 0
    expect(error?.message).toMatch(/^INVALID_AMOUNT: amount is too small/)
  })

  it('requires authentication', async () => {
    const { error } = await preview(anonClient(), 100, 'USD', 'EUR')
    expect(error).not.toBeNull()
  })

  it('refuses stale rates (older than 26h)', async () => {
    await seedFixtureRates(admin, new Date(Date.now() - 27 * 3_600_000))
    try {
      const { error } = await preview(asUser, 10_000, 'ILS', 'USD')
      expect(error?.message).toMatch(/^RATE_STALE/)
      // Same-currency needs no rate and still works.
      const same = await preview(asUser, 10_000, 'USD', 'USD')
      expect(same.error).toBeNull()
    } finally {
      await seedFixtureRates(admin)
    }
  })
})

// ---------------------------------------------------------------------------
describe('Wallet management', () => {
  it('adds a 0-balance wallet and rejects duplicates', async () => {
    const { data, error } = await asUser.rpc('add_wallet', { p_currency: 'EUR' })
    expect(error).toBeNull()
    expect(data).toMatchObject({ user_id: user.id, currency: 'EUR', balance_minor: 0 })

    const dup = await asUser.rpc('add_wallet', { p_currency: 'EUR' })
    expect(dup.error?.message).toMatch(/^WALLET_EXISTS/)

    const wallets = await walletsOf(user.id)
    expect(wallets.map((w) => [w.currency, w.balance_minor])).toEqual([
      ['ILS', 1_300_000],
      ['EUR', 0],
    ])
  })

  it('rejects unsupported currencies', async () => {
    const { error } = await asUser.rpc('add_wallet', { p_currency: 'JPY' as never })
    expect(error).not.toBeNull()
  })

  it('changing the preferred currency opens a 0 wallet and never grants funds', async () => {
    const { data, error } = await asUser.rpc('set_preferred_currency', { p_currency: 'GBP' })
    expect(error).toBeNull()
    expect(data).toMatchObject({ preferred_currency: 'GBP' })

    const wallets = await walletsOf(user.id)
    expect(wallets.find((w) => w.currency === 'GBP')).toMatchObject({ balance_minor: 0 })
    expect(wallets.find((w) => w.currency === 'ILS')).toMatchObject({ balance_minor: 1_300_000 })

    // Switching to a currency that already has a wallet doesn't duplicate it.
    await asUser.rpc('set_preferred_currency', { p_currency: 'ILS' })
    await asUser.rpc('set_preferred_currency', { p_currency: 'GBP' })
    expect(await walletsOf(user.id)).toHaveLength(3)

    const { data: txns } = await admin
      .from('transactions')
      .select('id')
      .eq('recipient_user_id', user.id)
    expect(txns).toHaveLength(1) // still only the initial grant
  })

  it('summarises all wallets in the preferred currency (server-side)', async () => {
    const { data, error } = await asUser.rpc('get_wallet_summary').single()
    expect(error).toBeNull()
    // Preferred is GBP; ₪13,000 × (0.8/3.7) = £2,810.81 (half-up); EUR and GBP wallets are 0.
    expect(data).toMatchObject({
      preferred_currency: 'GBP',
      wallet_count: 3,
      total_minor: 281_081,
      rates_stale: false,
    })
  })

  it('wallet operations require authentication', async () => {
    const anon = anonClient()
    expect((await anon.rpc('add_wallet', { p_currency: 'USD' })).error).not.toBeNull()
    expect((await anon.rpc('set_preferred_currency', { p_currency: 'USD' })).error).not.toBeNull()
    expect((await anon.rpc('get_wallet_summary')).error).not.toBeNull()
  })
})

describe('Historical integrity', () => {
  it('rate updates never modify existing transactions', async () => {
    const before = await admin.from('transactions').select('*').eq('recipient_user_id', user.id)
    await seedFixtureRates(admin)
    const after = await admin.from('transactions').select('*').eq('recipient_user_id', user.id)
    expect(after.data).toEqual(before.data)
  })
})
