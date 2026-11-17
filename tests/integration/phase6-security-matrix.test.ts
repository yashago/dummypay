import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '@/types/database'
import { restoreFx, seedFixtureRates, snapshotFx } from '../fixtures/fx'
import {
  admin,
  anonClient,
  createTestUser,
  deleteTrackedUsers,
  signInAs,
  SUPABASE_URL,
  type Client,
  type TestUser,
} from './helpers'

/**
 * Cross-user access matrix: a victim with data in every table, an outsider
 * and an anonymous visitor who try every read/write path against it.
 */

type Table = keyof Database['public']['Tables']

let snapshot: Awaited<ReturnType<typeof snapshotFx>>
let victim: TestUser, peer: TestUser, outsider: TestUser
let asVictim: Client, asOutsider: Client
const victimRows = {} as Record<Table, string[]>

beforeAll(async () => {
  snapshot = await snapshotFx(admin)
  await seedFixtureRates(admin)
  ;[victim, peer, outsider] = await Promise.all([
    createTestUser('ILS', 'Victim User'),
    createTestUser('USD', 'Peer User'),
    createTestUser('EUR', 'Outsider User'),
  ])
  ;[asVictim, asOutsider] = await Promise.all([signInAs(victim), signInAs(outsider)])

  // Give the victim data in every user-owned table.
  const q = await asVictim.rpc('create_transfer_quote', {
    p_recipient_id: peer.id,
    p_sending_currency: 'ILS',
    p_amount_minor: 1_000,
    p_input_side: 'send',
  })
  await asVictim.rpc('execute_transfer', { p_quote_id: q.data!.quote_id!, p_idempotency_key: randomUUID() })
  await asVictim.rpc('create_transfer_quote', {
    p_recipient_id: peer.id,
    p_sending_currency: 'ILS',
    p_amount_minor: 500,
    p_input_side: 'send',
  }) // an unused quote
  const asPeer = await signInAs(peer)
  const qBack = await asPeer.rpc('create_transfer_quote', {
    p_recipient_id: victim.id,
    p_sending_currency: 'USD',
    p_amount_minor: 100,
    p_input_side: 'send',
  })
  expect(qBack.error).toBeNull()
  await admin.from('payment_cards').insert({
    user_id: victim.id,
    cardholder_name: 'Victim User',
    card_brand: 'visa',
    last_four_digits: '4242',
    expiration_month: 1,
    expiration_year: 2031,
    mock_card_token: 'tok_sim_' + randomUUID().replace(/-/g, '').slice(0, 24),
  })
  await admin.from('bank_accounts').insert({
    user_id: victim.id,
    account_holder_name: 'Victim User',
    bank_name: 'Bank',
    country: 'IL',
    currency: 'ILS',
    identifier_type: 'account_number',
    masked_account_identifier: '•••• 1234',
  })
  // a notification for the victim: peer pays victim
  const q2 = await asPeer.rpc('create_transfer_quote', {
    p_recipient_id: victim.id,
    p_sending_currency: 'USD',
    p_amount_minor: 100,
    p_input_side: 'send',
  })
  await asPeer.rpc('execute_transfer', { p_quote_id: q2.data!.quote_id!, p_idempotency_key: randomUUID() })

  const ids = async (table: Table, column: string) => {
    const { data, error } = await admin.from(table).select('id').eq(column, victim.id)
    if (error) throw error
    return (data as unknown as { id: string }[]).map((r) => r.id)
  }
  victimRows.profiles = await ids('profiles', 'id')
  victimRows.wallets = await ids('wallets', 'user_id')
  victimRows.transactions = await ids('transactions', 'sender_user_id')
  victimRows.transfer_quotes = await ids('transfer_quotes', 'sender_user_id')
  victimRows.notifications = await ids('notifications', 'user_id')
  victimRows.payment_cards = await ids('payment_cards', 'user_id')
  victimRows.bank_accounts = await ids('bank_accounts', 'user_id')
  for (const [table, rows] of Object.entries(victimRows)) {
    expect(rows.length, `victim has ${table}`).toBeGreaterThan(0)
  }
})

afterAll(async () => {
  await restoreFx(admin, snapshot)
  await deleteTrackedUsers()
})

const USER_TABLES = [
  'profiles',
  'wallets',
  'transactions',
  'transfer_quotes',
  'notifications',
  'payment_cards',
  'bank_accounts',
] as const

const actors = () =>
  [
    ['outsider', asOutsider],
    ['anonymous', anonClient()],
  ] as const

// ---------------------------------------------------------------------------
describe.each(USER_TABLES)('table %s', (table) => {
  it('victim rows are invisible to other users and anonymous visitors', async () => {
    for (const [who, client] of actors()) {
      const { data } = await client.from(table).select('id').in('id', victimRows[table])
      expect(data ?? [], who).toEqual([])
    }
  })

  it('nobody else can update or delete victim rows', async () => {
    for (const [who, client] of actors()) {
      const upd = await client
        .from(table)
        .update({ created_at: new Date(0).toISOString() } as never)
        .in('id', victimRows[table])
        .select('id')
      expect(upd.data ?? [], `${who} update`).toEqual([])

      const del = await client.from(table).delete().in('id', victimRows[table]).select('id')
      expect(del.data ?? [], `${who} delete`).toEqual([])
    }
    const { data } = await admin.from(table).select('id').in('id', victimRows[table])
    expect(data).toHaveLength(victimRows[table].length)
  })

  it('direct inserts are refused for everyone (even the owner)', async () => {
    for (const [who, client] of [...actors(), ['owner', asVictim] as const]) {
      const ownerColumn = { profiles: 'id', transactions: 'recipient_user_id', transfer_quotes: 'sender_user_id' }[
        table as string
      ] ?? 'user_id'
      const { error } = await client.from(table).insert({ [ownerColumn]: victim.id } as never)
      // Must fail on privileges (42501), not merely on a missing column.
      expect(error?.code, `${who} insert`).toBe('42501')
    }
  })
})

describe('internal tables', () => {
  it.each(['fx_rate_history', 'rate_limits'] as const)('%s is not readable by users', async (table) => {
    for (const client of [asVictim, asOutsider, anonClient()]) {
      const { data } = await client.from(table).select('*').limit(1)
      expect(data ?? []).toEqual([])
    }
  })

  it.each(['fx_rates', 'fx_status', 'supported_currencies'] as const)(
    '%s cannot be modified by users',
    async (table) => {
      for (const client of [asVictim, anonClient()]) {
        const ins = await client.from(table).insert({} as never)
        expect(ins.error?.code).toBe('42501')
        const del = await client.from(table).delete().not('created_at' as never, 'is', null).select()
        expect(del.data ?? []).toEqual([])
      }
      const upd = await asVictim.from(table).update({ last_error: 'x', name: 'x', rate: 1 } as never).eq('id' as never, true as never)
      expect(upd.error).not.toBeNull()
    },
  )
})

// ---------------------------------------------------------------------------
describe('function exposure', () => {
  const INTERNAL = [
    ['ingest_fx_rates', { p_provider: 'x', p_provider_updated_at: new Date().toISOString(), p_rates: {} }],
    ['claim_fx_refresh', { p_min_interval: '1 second' }],
    ['record_fx_failure', { p_error: 'x' }],
    ['hit_rate_limit', { p_user: randomUUID(), p_action: 'x', p_limit: 1, p_window: '1 minute' }],
    ['format_money', { p_minor: 1, p_currency: 'USD' }],
    ['handle_new_user', {}],
    ['handle_user_email_change', {}],
    ['notify_transfer_recipient', {}],
    ['prevent_transaction_mutation', {}],
    ['touch_updated_at', {}],
  ] as const

  it.each(INTERNAL)('%s cannot be called by signed-in or anonymous users', async (fn, args) => {
    for (const client of [asOutsider, anonClient()]) {
      const { error } = await client.rpc(fn as never, args as never)
      expect(error, fn).not.toBeNull()
    }
  })

  const USER_RPCS = [
    ['add_wallet', { p_currency: 'GBP' }],
    ['set_preferred_currency', { p_currency: 'GBP' }],
    ['lookup_recipient', { p_email: 'a@b.co' }],
    ['create_transfer_quote', { p_recipient_id: randomUUID(), p_sending_currency: 'USD', p_amount_minor: 1, p_input_side: 'send' }],
    ['execute_transfer', { p_quote_id: randomUUID(), p_idempotency_key: randomUUID() }],
    ['mark_notifications_read', {}],
    ['preview_conversion', { p_amount_minor: 100, p_from: 'USD', p_to: 'EUR' }],
    ['get_wallet_summary', {}],
    ['list_my_transactions', {}],
  ] as const

  it.each(USER_RPCS)('%s refuses anonymous callers', async (fn, args) => {
    const { data, error } = await anonClient().rpc(fn as never, args as never)
    // Either refused outright, or (for the RLS-scoped history view) returns nothing.
    if (!error) expect(data ?? []).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('identity tampering', () => {
  it('a forged or garbage bearer token is rejected', async () => {
    const forged = [
      'garbage',
      // header.payload.signature claiming to be the victim, signed with nothing
      Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') +
        '.' +
        Buffer.from(JSON.stringify({ sub: victim.id, role: 'authenticated' })).toString('base64url') +
        '.',
    ]
    for (const token of forged) {
      const client = createClient<Database>(SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
      const { data, error } = await client.from('wallets').select('balance_minor')
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    }
  })

  it('profile mass-assignment (id, email, currency) is refused', async () => {
    for (const patch of [{ id: randomUUID() }, { email: 'x@y.zz' }, { preferred_currency: 'USD' }]) {
      const { error } = await asVictim.from('profiles').update(patch as never).eq('id', victim.id)
      expect(error?.code, JSON.stringify(patch)).toBe('42501')
    }
  })

  it('history cannot be widened to other users through RPC arguments', async () => {
    const { data } = await asOutsider.rpc('list_my_transactions', { p_limit: 100 })
    expect(data!.every((r) => r.sender_user_id === outsider.id || r.recipient_user_id === outsider.id)).toBe(true)
  })

  it('a quote for another user cannot be created by spoofing the sender', async () => {
    // No RPC accepts a sender id; the only way in is the caller's own session.
    const { data, error } = await asOutsider.rpc('create_transfer_quote', {
      p_recipient_id: victim.id,
      p_sending_currency: 'EUR',
      p_amount_minor: 100,
      p_input_side: 'send',
      p_sender_id: peer.id,
    } as never)
    // Unknown argument → function signature not found, never a quote from peer.
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})
