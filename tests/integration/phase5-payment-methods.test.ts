import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

let alice: TestUser, bob: TestUser
let asAlice: Client, asBob: Client

beforeAll(async () => {
  ;[alice, bob] = await Promise.all([createTestUser('ILS', 'Alice Cards'), createTestUser('USD', 'Bob Banks')])
  ;[asAlice, asBob] = await Promise.all([signInAs(alice), signInAs(bob)])
})

afterAll(async () => {
  await deleteTrackedUsers()
})

/** Calls a deployed Edge Function and returns HTTP status + JSON body. */
async function call(client: Client | null, fn: string, body: unknown) {
  const token = client ? (await client.auth.getSession()).data.session?.access_token : undefined
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

const VISA = '4242 4242 4242 4242'
const validCard = { cardholderName: 'Alice Cards', cardNumber: VISA, expiry: '12/30', cvv: '987' }
const validIban = {
  accountHolderName: 'Bob Banks',
  bankName: 'Barclays',
  country: 'GB',
  currency: 'GBP',
  accountIdentifier: 'GB82 WEST 1234 5698 7654 32',
}

// ---------------------------------------------------------------------------
describe('Payment cards', () => {
  it('stores only brand, last four, expiry and a mock token — never the PAN or CVV', async () => {
    const { status, body } = await call(asAlice, 'add-payment-card', validCard)
    expect(status).toBe(201)
    expect(body.card).toMatchObject({
      cardholder_name: 'Alice Cards',
      card_brand: 'visa',
      last_four_digits: '4242',
      expiration_month: 12,
      expiration_year: 2030,
    })
    expect(body.card).not.toHaveProperty('mock_card_token')

    const { data: row } = await admin.from('payment_cards').select('*').eq('id', body.card.id).single()
    expect(Object.keys(row!).sort()).toEqual([
      'card_brand',
      'cardholder_name',
      'created_at',
      'expiration_month',
      'expiration_year',
      'id',
      'last_four_digits',
      'mock_card_token',
      'user_id',
    ])
    expect(row!.user_id).toBe(alice.id)
    expect(row!.mock_card_token).toMatch(/^tok_sim_[A-Za-z0-9]{24}$/)
    const serialized = JSON.stringify(row)
    expect(serialized).not.toContain('4242424242424242')
    expect(serialized).not.toContain('987')
  })

  it('accepts Amex with a 4-digit CVV', async () => {
    const { status, body } = await call(asAlice, 'add-payment-card', {
      ...validCard,
      cardNumber: '3782 822463 10005',
      cvv: '1234',
    })
    expect(status).toBe(201)
    expect(body.card).toMatchObject({ card_brand: 'amex', last_four_digits: '0005' })
  })

  it.each([
    ['failed Luhn check', { cardNumber: '4242 4242 4242 4241' }, 'cardNumber'],
    ['expired card', { expiry: '01/20' }, 'expiry'],
    ['bad expiry format', { expiry: '2030-12' }, 'expiry'],
    ['short CVV', { cvv: '12' }, 'cvv'],
    ['non-numeric CVV', { cvv: 'abc' }, 'cvv'],
    ['missing name', { cardholderName: '' }, 'cardholderName'],
  ])('rejects a %s server-side (client bypassed)', async (_label, override, field) => {
    const { status, body } = await call(asAlice, 'add-payment-card', { ...validCard, ...override })
    expect(status).toBe(400)
    expect(body.error).toBe('VALIDATION_FAILED')
    expect(body.fields).toHaveProperty(field)
  })

  it('rejects malformed bodies and unauthenticated callers', async () => {
    expect((await call(asAlice, 'add-payment-card', 'not json')).status).toBe(400)
    expect((await call(asAlice, 'add-payment-card', [1, 2])).status).toBe(400)
    expect((await call(null, 'add-payment-card', validCard)).status).toBe(401)
  })

  it('ignores a user_id smuggled into the body', async () => {
    const { status, body } = await call(asAlice, 'add-payment-card', { ...validCard, user_id: bob.id })
    expect(status).toBe(201)
    const { data } = await admin.from('payment_cards').select('user_id').eq('id', body.card.id).single()
    expect(data!.user_id).toBe(alice.id)
  })

  it('users cannot insert or edit cards directly', async () => {
    const ins = await asAlice.from('payment_cards').insert({
      user_id: alice.id,
      cardholder_name: 'X Y',
      card_brand: 'visa',
      last_four_digits: '1111',
      expiration_month: 1,
      expiration_year: 2030,
      mock_card_token: 'tok_sim_' + 'a'.repeat(24),
    })
    expect(ins.error?.code).toBe('42501')
    const upd = await asAlice.from('payment_cards').update({ last_four_digits: '0000' }).eq('user_id', alice.id)
    expect(upd.error?.code).toBe('42501')
  })

  it('users see and delete only their own cards', async () => {
    const { data: mine } = await asAlice.from('payment_cards').select('id, user_id')
    expect(mine!.length).toBeGreaterThan(0)
    expect(mine!.every((c) => c.user_id === alice.id)).toBe(true)
    expect((await asBob.from('payment_cards').select('id')).data).toEqual([])
    expect((await anonClient().from('payment_cards').select('id')).data ?? []).toEqual([])

    const target = mine![0].id
    const bobDelete = await asBob.from('payment_cards').delete().eq('id', target).select()
    expect(bobDelete.data).toEqual([])
    const ownDelete = await asAlice.from('payment_cards').delete().eq('id', target).select('id')
    expect(ownDelete.data).toEqual([{ id: target }])
  })
})

// ---------------------------------------------------------------------------
describe('Bank accounts', () => {
  it('stores IBANs masked only', async () => {
    const { status, body } = await call(asBob, 'add-bank-account', validIban)
    expect(status).toBe(201)
    expect(body.account).toMatchObject({
      account_holder_name: 'Bob Banks',
      bank_name: 'Barclays',
      country: 'GB',
      currency: 'GBP',
      identifier_type: 'iban',
      masked_account_identifier: 'GB•• •••• 5432',
    })
    const { data: row } = await admin.from('bank_accounts').select('*').eq('id', body.account.id).single()
    expect(JSON.stringify(row)).not.toContain('WEST1234569876')
    expect(row!.user_id).toBe(bob.id)
  })

  it('stores plain account numbers masked', async () => {
    const { status, body } = await call(asBob, 'add-bank-account', {
      ...validIban,
      country: 'US',
      currency: 'USD',
      accountIdentifier: '000123456789',
    })
    expect(status).toBe(201)
    expect(body.account).toMatchObject({ identifier_type: 'account_number', masked_account_identifier: '•••• 6789' })
  })

  it.each([
    ['bad IBAN checksum', { accountIdentifier: 'GB82 WEST 1234 5698 7654 33' }, 'accountIdentifier'],
    ['IBAN from another country', { accountIdentifier: 'DE89 3704 0044 0532 0130 00' }, 'accountIdentifier'],
    ['unsupported country', { country: 'XX' }, 'country'],
    ['unsupported currency', { currency: 'JPY' }, 'currency'],
    ['missing bank name', { bankName: '' }, 'bankName'],
  ])('rejects %s server-side', async (_label, override, field) => {
    const { status, body } = await call(asBob, 'add-bank-account', { ...validIban, ...override })
    expect(status).toBe(400)
    expect(body.fields).toHaveProperty(field)
  })

  it('isolates accounts between users and blocks direct writes', async () => {
    expect((await call(null, 'add-bank-account', validIban)).status).toBe(401)
    expect((await asAlice.from('bank_accounts').select('id')).data).toEqual([])
    const ins = await asBob.from('bank_accounts').insert({
      user_id: bob.id,
      account_holder_name: 'Bob',
      bank_name: 'Bank',
      country: 'US',
      currency: 'USD',
      identifier_type: 'account_number',
      masked_account_identifier: '•••• 1234',
    })
    expect(ins.error?.code).toBe('42501')

    const { data: mine } = await asBob.from('bank_accounts').select('id')
    const del = await asAlice.from('bank_accounts').delete().eq('id', mine![0].id).select()
    expect(del.data).toEqual([])
    const own = await asBob.from('bank_accounts').delete().eq('id', mine![0].id).select('id')
    expect(own.data).toEqual([{ id: mine![0].id }])
  })

  it('the database itself refuses an unmasked identifier', async () => {
    const { error } = await admin.from('bank_accounts').insert({
      user_id: bob.id,
      account_holder_name: 'Bob',
      bank_name: 'Bank',
      country: 'GB',
      currency: 'GBP',
      identifier_type: 'iban',
      masked_account_identifier: 'GB82WEST12345698765432',
    })
    expect(error?.code).toBe('23514') // check_violation
  })
})
