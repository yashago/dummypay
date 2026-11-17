import { randomUUID } from 'node:crypto'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
let alice: TestUser, bob: TestUser, carol: TestUser
let asAlice: Client, asBob: Client, asCarol: Client
const channels: RealtimeChannel[] = []

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
  await Promise.all(channels.map((c) => c.unsubscribe()))
  for (const c of [asAlice, asBob, asCarol]) c.realtime.disconnect()
  await restoreFx(admin, snapshot)
  await deleteTrackedUsers()
})

async function send(client: Client, to: string, currency: 'ILS' | 'USD', amount: number, key = randomUUID()) {
  const q = await client.rpc('create_transfer_quote', {
    p_recipient_id: to,
    p_sending_currency: currency,
    p_amount_minor: amount,
    p_input_side: 'send',
  })
  if (q.error) throw q.error
  return client.rpc('execute_transfer', { p_quote_id: q.data.quote_id!, p_idempotency_key: key })
}

async function notificationsOf(userId: string) {
  const { data, error } = await admin.from('notifications').select('*').eq('user_id', userId)
  if (error) throw error
  return data
}

/**
 * Subscribes to postgres_changes and resolves once the database listener is
 * live. Note: `SUBSCRIBED` fires before that; readiness is announced by a
 * separate system message, and events in between would be missed.
 */
async function listen(
  client: Client,
  table: 'notifications' | 'wallets',
  event: 'INSERT' | 'UPDATE',
  filter?: string,
) {
  const received: Record<string, unknown>[] = []
  let ready!: () => void
  let failed!: (e: Error) => void
  const live = new Promise<void>((resolve, reject) => {
    ready = resolve
    failed = reject
  })
  const channel = client
    .channel(`test-${table}-${randomUUID()}`)
    .on('system', {}, (msg: { extension?: string; status?: string; message?: string }) => {
      if (msg.extension !== 'postgres_changes') return
      if (msg.status === 'ok') ready()
      else failed(new Error(msg.message ?? 'postgres_changes subscription failed'))
    })
    .on(
      'postgres_changes',
      { event, schema: 'public', table, ...(filter ? { filter } : {}) },
      (payload) => received.push(payload.new as Record<string, unknown>),
    )
  channels.push(channel)
  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') failed(err ?? new Error(status))
  })
  await live
  return received
}

async function waitFor(predicate: () => boolean, timeoutMs = 15_000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for realtime event')
    await new Promise((r) => setTimeout(r, 100))
  }
}

// ---------------------------------------------------------------------------
describe('Notification records', () => {
  it('a completed transfer notifies the recipient (and only the recipient)', async () => {
    const { data: txn, error } = await send(asAlice, bob.id, 'ILS', 10_000) // ₪100 → $27.03
    expect(error).toBeNull()

    const bobs = await notificationsOf(bob.id)
    expect(bobs).toHaveLength(1)
    expect(bobs[0]).toMatchObject({
      transaction_id: txn!.id,
      kind: 'payment_received',
      title: 'Payment received',
      message: `Alice Sender (${alice.email}) sent you $27.03.`,
      sender_display_name: 'Alice Sender',
      sender_email: alice.email,
      amount_minor: 2_703,
      currency: 'USD',
      is_read: false,
    })
    expect(await notificationsOf(alice.id)).toEqual([])
  })

  it('failed transfers create no notification', async () => {
    const before = (await notificationsOf(carol.id)).length
    const q = await asAlice.rpc('create_transfer_quote', {
      p_recipient_id: carol.id,
      p_sending_currency: 'ILS',
      p_amount_minor: 1_000,
      p_input_side: 'send',
    })
    await admin
      .from('transfer_quotes')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', q.data!.quote_id!)
    const res = await asAlice.rpc('execute_transfer', {
      p_quote_id: q.data!.quote_id!,
      p_idempotency_key: randomUUID(),
    })
    expect(res.error?.message).toMatch(/^QUOTE_EXPIRED/)
    expect(await notificationsOf(carol.id)).toHaveLength(before)
  })

  it('a replayed request does not notify twice', async () => {
    const before = (await notificationsOf(bob.id)).length
    const key = randomUUID()
    const q = await asAlice.rpc('create_transfer_quote', {
      p_recipient_id: bob.id,
      p_sending_currency: 'ILS',
      p_amount_minor: 500,
      p_input_side: 'send',
    })
    for (let i = 0; i < 3; i++) {
      await asAlice.rpc('execute_transfer', { p_quote_id: q.data!.quote_id!, p_idempotency_key: key })
    }
    expect(await notificationsOf(bob.id)).toHaveLength(before + 1)
  })
})

// ---------------------------------------------------------------------------
describe('Notification access control', () => {
  it('users only ever see their own notifications', async () => {
    const { data: bobView } = await asBob.from('notifications').select('user_id')
    expect(bobView!.length).toBeGreaterThan(0)
    expect(bobView!.every((n) => n.user_id === bob.id)).toBe(true)

    const { data: carolView } = await asCarol.from('notifications').select('*').eq('user_id', bob.id)
    expect(carolView).toEqual([])
    const { data: anonView } = await anonClient().from('notifications').select('*')
    expect(anonView ?? []).toEqual([])
  })

  it('users cannot create, edit or delete notifications directly', async () => {
    const [n] = await notificationsOf(bob.id)
    const ins = await asBob.from('notifications').insert({ ...n, id: randomUUID() } as never)
    expect(ins.error?.code).toBe('42501')
    const upd = await asBob.from('notifications').update({ message: 'forged' }).eq('id', n.id)
    expect(upd.error?.code).toBe('42501')
    const del = await asBob.from('notifications').delete().eq('id', n.id)
    expect(del.error?.code).toBe('42501')
  })

  it('marking as read only affects the caller’s own notifications', async () => {
    const bobs = await notificationsOf(bob.id)
    const carolTry = await asCarol.rpc('mark_notifications_read', { p_ids: bobs.map((n) => n.id) })
    expect(carolTry.data).toBe(0)
    expect((await notificationsOf(bob.id)).every((n) => !n.is_read)).toBe(true)

    const one = await asBob.rpc('mark_notifications_read', { p_ids: [bobs[0].id] })
    expect(one.data).toBe(1)
    const all = await asBob.rpc('mark_notifications_read', {})
    expect(all.data).toBe(bobs.length - 1)
    const after = await notificationsOf(bob.id)
    expect(after.every((n) => n.is_read && n.read_at)).toBe(true)

    expect((await anonClient().rpc('mark_notifications_read', {})).error).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('Realtime delivery', () => {
  it('pushes the notification and new balance to the recipient — and nothing to anyone else', async () => {
    const bobNotes = await listen(asBob, 'notifications', 'INSERT', `user_id=eq.${bob.id}`)
    const bobWallets = await listen(asBob, 'wallets', 'UPDATE', `user_id=eq.${bob.id}`)
    // Carol eavesdrops on the whole tables, unfiltered.
    const carolNotes = await listen(asCarol, 'notifications', 'INSERT')
    const carolWallets = await listen(asCarol, 'wallets', 'UPDATE')

    const { data: txn, error } = await send(asAlice, bob.id, 'ILS', 3_700) // ₪37 → $10.00
    expect(error).toBeNull()

    await waitFor(() => bobNotes.length > 0 && bobWallets.length > 0)
    expect(bobNotes[0]).toMatchObject({
      user_id: bob.id,
      transaction_id: txn!.id,
      sender_display_name: 'Alice Sender',
      sender_email: alice.email,
      amount_minor: 1_000,
      currency: 'USD',
    })
    const { data: wallet } = await admin
      .from('wallets')
      .select('balance_minor')
      .eq('user_id', bob.id)
      .eq('currency', 'USD')
      .single()
    expect(bobWallets.at(-1)).toMatchObject({ user_id: bob.id, balance_minor: wallet!.balance_minor })

    // Give any leaked events time to arrive before asserting there were none.
    await new Promise((r) => setTimeout(r, 3_000))
    expect(carolNotes).toEqual([])
    expect(carolWallets).toEqual([])
  })
})
