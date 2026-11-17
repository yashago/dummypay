// add-payment-card — registers a SIMULATED card for the signed-in user.
//
// The full card number and CVV exist only in this request's memory: they are
// validated (Luhn, brand, length, MM/YY expiry, CVV format) and then discarded.
// Only brand, last four digits, expiry and a random mock token are stored.
// Request bodies are never logged. No payment processor is contacted.

import { validateCard } from '../_shared/payment-validation.ts'
import { adminClient, authenticate, corsHeaders, json, randomToken, readJsonObject } from '../_shared/http.ts'

const MAX_CARDS_PER_USER = 10

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  const admin = adminClient()
  const user = await authenticate(req, admin)
  if (!user) return json({ error: 'NOT_AUTHENTICATED' }, 401)

  const body = await readJsonObject(req)
  if (!body) return json({ error: 'INVALID_REQUEST' }, 400)

  const result = validateCard({
    cardholderName: body.cardholderName,
    cardNumber: body.cardNumber,
    expiry: body.expiry,
    cvv: body.cvv,
  })
  if (!result.ok) return json({ error: 'VALIDATION_FAILED', fields: result.errors }, 400)

  const { count, error: countError } = await admin
    .from('payment_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (countError) return json({ error: 'INTERNAL' }, 500)
  if ((count ?? 0) >= MAX_CARDS_PER_USER) return json({ error: 'LIMIT_REACHED' }, 409)

  const card = result.value
  const { data, error } = await admin
    .from('payment_cards')
    .insert({
      user_id: user.id,
      cardholder_name: card.cardholderName,
      card_brand: card.brand,
      last_four_digits: card.lastFour,
      expiration_month: card.expMonth,
      expiration_year: card.expYear,
      mock_card_token: `tok_sim_${randomToken(24)}`,
    })
    .select('id, cardholder_name, card_brand, last_four_digits, expiration_month, expiration_year, created_at')
    .single()
  if (error) return json({ error: 'INTERNAL' }, 500)

  return json({ card: data }, 201)
})
