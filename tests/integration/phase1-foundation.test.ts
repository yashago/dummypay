import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  admin,
  anonClient,
  createTestUser,
  deleteTrackedUsers,
  SIGN_IN_TIMEOUT_MS,
  signInAs,
  testEmail,
  TEST_PASSWORD,
  trackUser,
  type Client,
  type TestUser,
} from './helpers'

afterAll(async () => {
  await deleteTrackedUsers()
})

async function walletsOf(userId: string) {
  const { data, error } = await admin.from('wallets').select('*').eq('user_id', userId)
  if (error) throw error
  return data
}

async function transactionsOf(userId: string) {
  const { data, error } = await admin
    .from('transactions')
    .select('*')
    .or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
describe('Registration & initial grant', () => {
  it('public sign-up creates profile, preferred wallet and a one-time ILS 13,000 grant', async () => {
    const client = anonClient()
    const email = testEmail('signup')
    const { data, error } = await client.auth.signUp({
      email,
      password: TEST_PASSWORD,
      options: { data: { display_name: '  Dana Signup  ', preferred_currency: 'ILS' } },
    })
    expect(error).toBeNull()
    trackUser(data.user!.id)
    expect(data.session).not.toBeNull() // email confirmation is off

    const { data: profile } = await client.from('profiles').select('*').single()
    expect(profile).toMatchObject({
      id: data.user!.id,
      email,
      display_name: 'Dana Signup', // trimmed server-side
      preferred_currency: 'ILS',
    })
    expect(profile!.created_at).toBeTruthy()

    const { data: wallets } = await client.from('wallets').select('currency, balance_minor')
    expect(wallets).toEqual([{ currency: 'ILS', balance_minor: 1_300_000 }])

    const { data: txns } = await client.from('transactions').select('*')
    expect(txns).toHaveLength(1)
    expect(txns![0]).toMatchObject({
      type: 'initial_grant',
      status: 'completed',
      recipient_user_id: data.user!.id,
      receiving_amount_minor: 1_300_000,
      receiving_currency: 'ILS',
      sender_user_id: null,
      exchange_rate: null,
    })
  })

  it.each([
    ['USD', 500_000],
    ['EUR', 500_000],
    ['GBP', 500_000],
  ] as const)('grants %s %i minor units in exactly one wallet', async (currency, expected) => {
    const user = await createTestUser(currency)
    const wallets = await walletsOf(user.id)
    expect(wallets).toHaveLength(1)
    expect(wallets[0]).toMatchObject({ currency, balance_minor: expected })

    const txns = await transactionsOf(user.id)
    expect(txns).toHaveLength(1)
    expect(txns[0]).toMatchObject({ type: 'initial_grant', receiving_amount_minor: expected })
  })

  it('rejects sign-up with an unsupported currency and creates nothing', async () => {
    const email = testEmail('badcur')
    const { error } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: 'Bad Currency', preferred_currency: 'JPY' },
    })
    expect(error).not.toBeNull()
    const { data } = await admin.from('profiles').select('id').eq('email', email)
    expect(data).toEqual([])
  })

  it.each([
    ['missing', undefined],
    ['too short', 'A'],
    ['too long', 'x'.repeat(51)],
  ])('rejects sign-up with a %s display name', async (_label, displayName) => {
    const email = testEmail('badname')
    const { error } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName, preferred_currency: 'USD' },
    })
    expect(error).not.toBeNull()
    const { data } = await admin.from('profiles').select('id').eq('email', email)
    expect(data).toEqual([])
  })

  it('rejects a duplicate email address', async () => {
    const existing = await createTestUser('EUR')
    const { data, error } = await anonClient().auth.signUp({
      email: existing.email,
      password: TEST_PASSWORD,
      options: { data: { display_name: 'Duplicate', preferred_currency: 'USD' } },
    })
    expect(error?.code).toBe('user_already_exists')
    expect(data.user).toBeNull()
    expect(await walletsOf(existing.id)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
describe('Authorization & data isolation', () => {
  let alice: TestUser
  let bob: TestUser
  let asAlice: Client

  beforeAll(async () => {
    ;[alice, bob] = await Promise.all([
      createTestUser('ILS', 'Alice Test'),
      createTestUser('USD', 'Bob Test'),
    ])
    asAlice = await signInAs(alice)
  }, SIGN_IN_TIMEOUT_MS)

  it('a user sees only their own profile', async () => {
    const { data: all } = await asAlice.from('profiles').select('id')
    expect(all).toEqual([{ id: alice.id }])
    const { data: other } = await asAlice.from('profiles').select('*').eq('id', bob.id)
    expect(other).toEqual([])
  })

  it('a user sees only their own wallets and transactions', async () => {
    const { data: wallets } = await asAlice.from('wallets').select('user_id')
    expect(wallets!.every((w) => w.user_id === alice.id)).toBe(true)
    const { data: bobsWallets } = await asAlice.from('wallets').select('*').eq('user_id', bob.id)
    expect(bobsWallets).toEqual([])

    const { data: txns } = await asAlice.from('transactions').select('recipient_user_id')
    expect(txns).toEqual([{ recipient_user_id: alice.id }])
  })

  it('unauthenticated clients cannot read financial data', async () => {
    const anon = anonClient()
    for (const table of ['profiles', 'wallets', 'transactions'] as const) {
      const { data } = await anon.from(table).select('*')
      expect(data ?? []).toEqual([])
    }
  })

  it('a user cannot change any wallet balance directly', async () => {
    const [wallet] = await walletsOf(alice.id)
    const { error } = await asAlice
      .from('wallets')
      .update({ balance_minor: 999_999_999 })
      .eq('id', wallet.id)
    expect(error?.code).toBe('42501') // permission denied
    expect((await walletsOf(alice.id))[0].balance_minor).toBe(1_300_000)
  })

  it('a user cannot create wallets or grant themselves funds', async () => {
    const { error: walletErr } = await asAlice
      .from('wallets')
      .insert({ user_id: alice.id, currency: 'USD', balance_minor: 1_000_000 })
    expect(walletErr?.code).toBe('42501')

    const [wallet] = await walletsOf(alice.id)
    const { error: txnErr } = await asAlice.from('transactions').insert({
      type: 'initial_grant',
      recipient_user_id: alice.id,
      recipient_wallet_id: wallet.id,
      receiving_amount_minor: 1_000_000,
      receiving_currency: 'ILS',
      recipient_display_name: 'Alice Test',
      recipient_email: alice.email,
    })
    expect(txnErr?.code).toBe('42501')
    expect(await walletsOf(alice.id)).toHaveLength(1)
  })

  it('updating Auth metadata after sign-up never grants funds again', async () => {
    const { error } = await asAlice.auth.updateUser({
      data: { preferred_currency: 'USD', display_name: 'Changed' },
    })
    expect(error).toBeNull()
    const wallets = await walletsOf(alice.id)
    expect(wallets).toEqual([expect.objectContaining({ currency: 'ILS', balance_minor: 1_300_000 })])
    expect(await transactionsOf(alice.id)).toHaveLength(1)
  })

  it('a user cannot call the sign-up trigger function', async () => {
    const { error } = await asAlice.rpc('handle_new_user' as never)
    expect(error).not.toBeNull()
  })

  it('only display_name is editable, and only on your own profile', async () => {
    const own = await asAlice
      .from('profiles')
      .update({ display_name: 'Alice Renamed' })
      .eq('id', alice.id)
      .select('display_name')
    expect(own.error).toBeNull()
    expect(own.data).toEqual([{ display_name: 'Alice Renamed' }])

    const currency = await asAlice
      .from('profiles')
      .update({ preferred_currency: 'GBP' })
      .eq('id', alice.id)
    expect(currency.error?.code).toBe('42501')

    const email = await asAlice
      .from('profiles')
      .update({ email: 'hijack@example.com' })
      .eq('id', alice.id)
    expect(email.error?.code).toBe('42501')

    const other = await asAlice
      .from('profiles')
      .update({ display_name: 'Hacked' })
      .eq('id', bob.id)
      .select()
    expect(other.data).toEqual([])
    const { data: bobProfile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', bob.id)
      .single()
    expect(bobProfile!.display_name).toBe('Bob Test')
  })

  it('rejects an invalid display name at the database level', async () => {
    const { error } = await asAlice.from('profiles').update({ display_name: 'x' }).eq('id', alice.id)
    expect(error?.code).toBe('23514') // check_violation
  })

  it('transactions are immutable — even for the service role', async () => {
    const [txn] = await transactionsOf(alice.id)
    const upd = await admin
      .from('transactions')
      .update({ receiving_amount_minor: 1 })
      .eq('id', txn.id)
    expect(upd.error?.message).toMatch(/TRANSACTION_IMMUTABLE/)

    const del = await admin.from('transactions').delete().eq('id', txn.id)
    expect(del.error?.message).toMatch(/TRANSACTION_IMMUTABLE/)

    const userDel = await asAlice.from('transactions').delete().eq('id', txn.id)
    expect(userDel.error?.code).toBe('42501')
  })
})
