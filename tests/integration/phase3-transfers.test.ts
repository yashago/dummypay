import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CurrencyCode } from '@/lib/money'
import { restoreFx, seedFixtureRates, snapshotFx } from '../fixtures/fx'
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

// alice: ILS 13,000 · bob: USD 5,000 · carol: EUR 5,000 (outsider)
let alice: TestUser, bob: TestUser, carol: TestUser
let asAlice: Client, asBob: Client, asCarol: Client

beforeAll(async () => {
  snapshot = await snapshotFx(admin)
  await seedFixtureRates(admin)
  ;[alice, bob, carol] = await Promise.all([
    createTestUser('ILS', 'Alice Sender'),
    createTestUser('USD', 'Bob Receiver'),
    createTestUser('EUR', 'Carol Outsider'),
  ])
  ;[asAlice, asBob, asCarol] = await Promise.all([signInAs(alice), signInAs(bob), signInAs(carol)])
})

afterAll(async () => {
  await restoreFx(admin, snapshot)
  await deleteTrackedUsers()
})

// --- helpers ----------------------------------------------------------------
async function balance(userId: string, currency: CurrencyCode): Promise<number | undefined> {
  const { data } = await admin
    .from('wallets')
    .select('balance_minor')
    .eq('user_id', userId)
    .eq('currency', currency)
    .maybeSingle()
  return data?.balance_minor
}

async function quote(
  client: Client,
  recipientId: string,
  currency: CurrencyCode,
  amount: number,
  side: 'send' | 'receive' = 'send',
) {
  return client.rpc('create_transfer_quote', {
    p_recipient_id: recipientId,
    p_sending_currency: currency,
    p_amount_minor: amount,
    p_input_side: side,
  })
}

async function execute(client: Client, quoteId: string, key: string = randomUUID()) {
  return client.rpc('execute_transfer', { p_quote_id: quoteId, p_idempotency_key: key })
}

async function quoteAndSend(
  client: Client,
  recipientId: string,
  currency: CurrencyCode,
  amount: number,
  side: 'send' | 'receive' = 'send',
) {
  const q = await quote(client, recipientId, currency, amount, side)
  if (q.error) throw q.error
  const r = await execute(client, q.data.quote_id!)
  if (r.error) throw r.error
  return { quote: q.data, txn: r.data }
}

/** Ledger invariant: balance = initial grant + credits − debits (from transactions). */
async function reconcile(userId: string) {
  const [{ data: wallets }, { data: txns }] = await Promise.all([
    admin.from('wallets').select('id, balance_minor').eq('user_id', userId),
    admin
      .from('transactions')
      .select('sender_wallet_id, recipient_wallet_id, sending_amount_minor, receiving_amount_minor')
      .or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`),
  ])
  for (const w of wallets!) {
    const credits = txns!
      .filter((t) => t.recipient_wallet_id === w.id)
      .reduce((s, t) => s + t.receiving_amount_minor, 0)
    const debits = txns!
      .filter((t) => t.sender_wallet_id === w.id)
      .reduce((s, t) => s + (t.sending_amount_minor ?? 0), 0)
    expect(w.balance_minor, `wallet ${w.id}`).toBe(credits - debits)
    expect(w.balance_minor).toBeGreaterThanOrEqual(0)
  }
}

// ---------------------------------------------------------------------------
describe('Recipient lookup', () => {
  it('returns only the minimum information for a registered user (case-insensitive)', async () => {
    const { data, error } = await asAlice.rpc('lookup_recipient', { p_email: bob.email.toUpperCase() })
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        status: 'found',
        user_id: bob.id,
        display_name: 'Bob Receiver',
        email: bob.email,
        preferred_currency: 'USD',
      },
    ])
  })

  it('reports unregistered emails without creating anything', async () => {
    const ghost = `ghost-${randomUUID()}@test.dummypay.dev`
    const { data } = await asAlice.rpc('lookup_recipient', { p_email: ghost })
    expect(data).toEqual([
      { status: 'not_found', user_id: null, display_name: null, email: null, preferred_currency: null },
    ])
    const { data: profiles } = await admin.from('profiles').select('id').eq('email', ghost)
    expect(profiles).toEqual([])
  })

  it('flags the caller’s own email', async () => {
    const { data } = await asAlice.rpc('lookup_recipient', { p_email: alice.email })
    expect(data![0].status).toBe('self')
    expect(data![0].user_id).toBeNull()
  })

  it.each(['not-an-email', '', 'a@b', 'x'.repeat(250) + '@example.com'])(
    'rejects malformed email %j',
    async (email) => {
      const { error } = await asAlice.rpc('lookup_recipient', { p_email: email })
      expect(error?.message).toMatch(/^INVALID_EMAIL/)
    },
  )

  it('requires authentication', async () => {
    const { error } = await anonClient().rpc('lookup_recipient', { p_email: bob.email })
    expect(error).not.toBeNull()
  })

  it('is rate limited (20/min), counting failed probes too', async () => {
    const prober = await createTestUser('USD', 'Prober')
    const asProber = await signInAs(prober)
    const results = []
    for (let i = 0; i < 21; i++) {
      results.push(
        await asProber.rpc('lookup_recipient', { p_email: `probe-${i}@test.dummypay.dev` }),
      )
    }
    expect(results.slice(0, 20).every((r) => r.error === null)).toBe(true)
    expect(results[20].error?.message).toMatch(/^RATE_LIMITED/)
  })
})

// ---------------------------------------------------------------------------
describe('Quotes', () => {
  it('prices "I send ₪100" into the recipient’s preferred currency', async () => {
    const { data, error } = await quote(asAlice, bob.id, 'ILS', 10_000, 'send')
    expect(error).toBeNull()
    expect(data).toMatchObject({
      recipient_user_id: bob.id,
      recipient_display_name: 'Bob Receiver',
      sending_currency: 'ILS',
      receiving_currency: 'USD',
      sending_amount_minor: 10_000,
      receiving_amount_minor: 2_703,
      exchange_rate: 0.2702702703,
      amount_input_side: 'send',
    })
    const ttl = Date.parse(data!.expires_at!) - Date.now()
    expect(ttl).toBeGreaterThan(30_000)
    expect(ttl).toBeLessThanOrEqual(65_000)
  })

  it('prices "recipient gets $100" (spec §5.3 example)', async () => {
    const { data } = await quote(asAlice, bob.id, 'ILS', 10_000, 'receive')
    expect(data).toMatchObject({ sending_amount_minor: 37_000, receiving_amount_minor: 10_000 })
  })

  it.each([
    ['self transfer', () => alice.id, 'ILS', 100, /^SELF_TRANSFER/],
    ['unknown recipient', () => randomUUID(), 'ILS', 100, /^RECIPIENT_NOT_FOUND/],
    ['zero amount', () => bob.id, 'ILS', 0, /^INVALID_AMOUNT/],
    ['negative amount', () => bob.id, 'ILS', -500, /^INVALID_AMOUNT/],
    ['amount above limit', () => bob.id, 'ILS', 100_000_001, /^INVALID_AMOUNT/],
    ['sub-unit result', () => bob.id, 'ILS', 1, /too small/],
    ['missing wallet', () => bob.id, 'GBP', 100, /^NO_WALLET/],
    ['more than balance', () => bob.id, 'ILS', 1_300_001, /^INSUFFICIENT_FUNDS/],
  ] as const)('rejects %s', async (_label, recipient, currency, amount, message) => {
    const { error } = await quote(asAlice, recipient(), currency as CurrencyCode, amount)
    expect(error?.message).toMatch(message)
  })

  it('rejects quotes when rates are stale', async () => {
    await seedFixtureRates(admin, new Date(Date.now() - 27 * 3_600_000))
    try {
      const { error } = await quote(asAlice, bob.id, 'ILS', 10_000)
      expect(error?.message).toMatch(/^RATE_STALE/)
    } finally {
      await seedFixtureRates(admin)
    }
  })

  it('rejects fractional amounts (supported precision only)', async () => {
    const { error } = await quote(asAlice, bob.id, 'ILS', 10.5)
    expect(error).not.toBeNull()
  })

  it('cannot be created by anonymous users or read by others', async () => {
    expect((await quote(anonClient(), bob.id, 'ILS', 100)).error).not.toBeNull()
    const { data: mine } = await asAlice.from('transfer_quotes').select('id')
    expect(mine!.length).toBeGreaterThan(0)
    const { data: theirs } = await asCarol.from('transfer_quotes').select('id')
    expect(theirs).toEqual([])
    const { error } = await asAlice.from('transfer_quotes').update({ sending_amount_minor: 1 }).eq('sender_user_id', alice.id)
    expect(error?.code).toBe('42501')
  })
})

// ---------------------------------------------------------------------------
describe('Transfer execution', () => {
  it('debits the sender, credits the recipient and stores the rate (spec §5.3)', async () => {
    const [aBefore, bBefore] = await Promise.all([balance(alice.id, 'ILS'), balance(bob.id, 'USD')])
    const { txn } = await quoteAndSend(asAlice, bob.id, 'ILS', 10_000, 'receive') // bob gets $100

    expect(await balance(alice.id, 'ILS')).toBe(aBefore! - 37_000)
    expect(await balance(bob.id, 'USD')).toBe(bBefore! + 10_000)
    expect(txn).toMatchObject({
      type: 'transfer',
      status: 'completed',
      sender_user_id: alice.id,
      recipient_user_id: bob.id,
      sending_amount_minor: 37_000,
      sending_currency: 'ILS',
      receiving_amount_minor: 10_000,
      receiving_currency: 'USD',
      exchange_rate: 0.2702702703,
      amount_input_side: 'receive',
      sender_display_name: 'Alice Sender',
      sender_email: alice.email,
      recipient_display_name: 'Bob Receiver',
      recipient_email: bob.email,
    })
    expect(txn.rate_provider).toBe('test-fixture')
  })

  it('both parties — and only they — see the transaction', async () => {
    const { txn } = await quoteAndSend(asAlice, bob.id, 'ILS', 500)
    for (const c of [asAlice, asBob]) {
      const { data } = await c.from('transactions').select('id').eq('id', txn.id)
      expect(data).toEqual([{ id: txn.id }])
    }
    const { data } = await asCarol.from('transactions').select('id').eq('id', txn.id)
    expect(data).toEqual([])
  })

  it('credits a recipient’s new preferred currency wallet', async () => {
    await asCarol.rpc('set_preferred_currency', { p_currency: 'GBP' })
    try {
      const { txn } = await quoteAndSend(asBob, carol.id, 'USD', 1_000) // $10 → £8.00
      expect(txn).toMatchObject({ receiving_currency: 'GBP', receiving_amount_minor: 800 })
      expect(await balance(carol.id, 'GBP')).toBe(800)
    } finally {
      await asCarol.rpc('set_preferred_currency', { p_currency: 'EUR' })
    }
  })

  it('same-currency transfers use a rate of exactly 1', async () => {
    const dave = await createTestUser('USD', 'Dave Dollar') // recipient only — no sign-in needed
    const { txn } = await quoteAndSend(asBob, dave.id, 'USD', 2_500, 'send')
    expect(txn).toMatchObject({
      sending_currency: 'USD',
      receiving_currency: 'USD',
      sending_amount_minor: 2_500,
      receiving_amount_minor: 2_500,
      exchange_rate: 1,
    })
    expect(await balance(dave.id, 'USD')).toBe(502_500)
  })

  it('rejects an expired quote and changes nothing', async () => {
    const { data: q } = await quote(asAlice, bob.id, 'ILS', 1_000)
    await admin
      .from('transfer_quotes')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', q!.quote_id!)
    const before = await balance(alice.id, 'ILS')
    const { error } = await execute(asAlice, q!.quote_id!)
    expect(error?.message).toMatch(/^QUOTE_EXPIRED/)
    expect(await balance(alice.id, 'ILS')).toBe(before)
  })

  it('rejects another user’s quote (identity comes from the session)', async () => {
    const { data: q } = await quote(asAlice, bob.id, 'ILS', 1_000)
    const { error } = await execute(asCarol, q!.quote_id!)
    expect(error?.message).toMatch(/^QUOTE_NOT_FOUND/)
    const { error: bobErr } = await execute(asBob, q!.quote_id!)
    expect(bobErr?.message).toMatch(/^QUOTE_NOT_FOUND/)
  })

  it('rejects a made-up quote id and anonymous callers', async () => {
    expect((await execute(asAlice, randomUUID())).error?.message).toMatch(/^QUOTE_NOT_FOUND/)
    expect((await execute(anonClient(), randomUUID())).error).not.toBeNull()
  })

  it('re-checks the balance at execution time (insufficient funds)', async () => {
    const poor = await createTestUser('USD', 'Poor Sender')
    const asPoor = await signInAs(poor)
    const { data: q1 } = await quote(asPoor, bob.id, 'USD', 400_000)
    const { data: q2 } = await quote(asPoor, bob.id, 'USD', 400_000)
    expect((await execute(asPoor, q1!.quote_id!)).error).toBeNull()
    const second = await execute(asPoor, q2!.quote_id!)
    expect(second.error?.message).toMatch(/^INSUFFICIENT_FUNDS/)
    expect(await balance(poor.id, 'USD')).toBe(100_000)
    await reconcile(poor.id)
  })

  it('users still cannot write balances or transactions directly', async () => {
    const { error } = await asAlice.from('wallets').update({ balance_minor: 0 }).eq('user_id', bob.id)
    expect(error?.code).toBe('42501')
    const { error: insErr } = await asAlice.from('transactions').insert({
      type: 'transfer',
      sender_user_id: bob.id,
      recipient_user_id: alice.id,
      recipient_wallet_id: randomUUID(),
      receiving_amount_minor: 1,
      receiving_currency: 'ILS',
    } as never)
    expect(insErr?.code).toBe('42501')
  })
})

// ---------------------------------------------------------------------------
describe('Idempotency', () => {
  it('replaying the same request returns the original transfer and debits once', async () => {
    const { data: q } = await quote(asAlice, bob.id, 'ILS', 1_000)
    const key = randomUUID()
    const before = await balance(alice.id, 'ILS')
    const first = await execute(asAlice, q!.quote_id!, key)
    const second = await execute(asAlice, q!.quote_id!, key)
    expect(first.error).toBeNull()
    expect(second.data!.id).toBe(first.data!.id)
    expect(await balance(alice.id, 'ILS')).toBe(before! - 1_000)
  })

  it('10 parallel duplicates (double-click / retry storm) move money once', async () => {
    const { data: q } = await quote(asAlice, bob.id, 'ILS', 2_000)
    const key = randomUUID()
    const before = await balance(alice.id, 'ILS')
    const results = await Promise.all(Array.from({ length: 10 }, () => execute(asAlice, q!.quote_id!, key)))
    expect(results.every((r) => r.error === null)).toBe(true)
    expect(new Set(results.map((r) => r.data!.id)).size).toBe(1)
    expect(await balance(alice.id, 'ILS')).toBe(before! - 2_000)
  })

  it('a used quote cannot be spent again with a new key', async () => {
    const { data: q } = await quote(asAlice, bob.id, 'ILS', 1_000)
    expect((await execute(asAlice, q!.quote_id!)).error).toBeNull()
    const again = await execute(asAlice, q!.quote_id!)
    expect(again.error?.message).toMatch(/^QUOTE_USED/)
  })

  it('a key cannot be reused for a different quote', async () => {
    const key = randomUUID()
    const { data: q1 } = await quote(asAlice, bob.id, 'ILS', 1_000)
    const { data: q2 } = await quote(asAlice, bob.id, 'ILS', 1_000)
    expect((await execute(asAlice, q1!.quote_id!, key)).error).toBeNull()
    const res = await execute(asAlice, q2!.quote_id!, key)
    expect(res.error?.message).toMatch(/^IDEMPOTENCY_CONFLICT/)
  })
})

// ---------------------------------------------------------------------------
describe('Concurrency', () => {
  it('parallel transfers can never overdraw a wallet', async () => {
    const spender = await createTestUser('USD', 'Concurrent Spender') // $5,000
    const asSpender = await signInAs(spender)
    // 8 quotes of $1,000 each — each individually affordable, together not.
    const quotes = []
    for (let i = 0; i < 8; i++) {
      const { data, error } = await quote(asSpender, bob.id, 'USD', 100_000)
      expect(error).toBeNull()
      quotes.push(data!.quote_id!)
    }
    const bobBefore = await balance(bob.id, 'USD')
    const results = await Promise.all(quotes.map((id) => execute(asSpender, id)))

    const ok = results.filter((r) => r.error === null)
    const failed = results.filter((r) => r.error !== null)
    expect(ok).toHaveLength(5)
    expect(failed.every((r) => /^INSUFFICIENT_FUNDS/.test(r.error!.message))).toBe(true)
    expect(await balance(spender.id, 'USD')).toBe(0)
    expect(await balance(bob.id, 'USD')).toBe(bobBefore! + 500_000)
    await reconcile(spender.id)
  })

  it('opposite-direction transfers run concurrently without deadlocks or lost updates', async () => {
    const [x, y] = await Promise.all([createTestUser('USD', 'Storm X'), createTestUser('USD', 'Storm Y')])
    const [asX, asY] = await Promise.all([signInAs(x), signInAs(y)])
    const make = async (c: Client, to: string) => (await quote(c, to, 'USD', 1_000)).data!.quote_id!
    const xQuotes = await Promise.all(Array.from({ length: 6 }, () => make(asX, y.id)))
    const yQuotes = await Promise.all(Array.from({ length: 6 }, () => make(asY, x.id)))

    const results = await Promise.all([
      ...xQuotes.map((q) => execute(asX, q)),
      ...yQuotes.map((q) => execute(asY, q)),
    ])
    expect(results.filter((r) => r.error).map((r) => r.error!.message)).toEqual([])
    expect(await balance(x.id, 'USD')).toBe(500_000)
    expect(await balance(y.id, 'USD')).toBe(500_000)
    await reconcile(x.id)
    await reconcile(y.id)
  })
})

// ---------------------------------------------------------------------------
describe('Transaction history', () => {
  it('filters by direction and currency, newest first, with a total count', async () => {
    const all = await asBob.rpc('list_my_transactions', { p_limit: 100 })
    expect(all.error).toBeNull()
    const rows = all.data!
    expect(rows.length).toBeGreaterThan(3)
    expect(rows[0].total_count).toBe(rows.length)
    const times = rows.map((r) => Date.parse(r.created_at!))
    expect([...times].sort((a, b) => b - a)).toEqual(times)

    const sent = await asBob.rpc('list_my_transactions', { p_direction: 'sent', p_limit: 100 })
    expect(sent.data!.length).toBeGreaterThan(0)
    expect(sent.data!.every((r) => r.direction === 'sent' && r.sender_user_id === bob.id)).toBe(true)

    const received = await asBob.rpc('list_my_transactions', { p_direction: 'received', p_limit: 100 })
    expect(received.data!.every((r) => r.direction === 'received' && r.recipient_user_id === bob.id)).toBe(true)
    expect(sent.data!.length + received.data!.length).toBe(rows.length)

    const usd = await asBob.rpc('list_my_transactions', { p_currency: 'USD', p_limit: 100 })
    expect(
      usd.data!.every((r) =>
        r.direction === 'sent' ? r.sending_currency === 'USD' : r.receiving_currency === 'USD',
      ),
    ).toBe(true)
  })

  it('filters by date range and paginates', async () => {
    const future = await asBob.rpc('list_my_transactions', {
      p_from: new Date(Date.now() + 86_400_000).toISOString(),
    })
    expect(future.data).toEqual([])
    const page1 = await asBob.rpc('list_my_transactions', { p_limit: 2, p_offset: 0 })
    const page2 = await asBob.rpc('list_my_transactions', { p_limit: 2, p_offset: 2 })
    expect(page1.data).toHaveLength(2)
    expect(page2.data![0].id).not.toBe(page1.data![1].id)
    expect(page2.data![0].total_count).toBe(page1.data![0].total_count)
  })

  it('shows counterparties without exposing anyone else’s data', async () => {
    const { data } = await asCarol.rpc('list_my_transactions', { p_limit: 100 })
    const ids = new Set(data!.flatMap((r) => [r.sender_user_id, r.recipient_user_id]))
    // Carol only ever transacted with Bob (and her own grant).
    for (const id of ids) expect([carol.id, bob.id, null]).toContain(id)
    const grant = data!.find((r) => r.type === 'initial_grant')
    expect(grant).toMatchObject({ direction: 'received', recipient_display_name: 'Carol Outsider' })
  })

  it('all ledgers reconcile after the whole suite', async () => {
    for (const u of [alice, bob, carol]) await reconcile(u.id)
  })
})
