// add-bank-account — registers a SIMULATED bank account for the signed-in user.
//
// The IBAN / account number is validated (format, country length, mod-97
// checksum) and stored masked only (e.g. "IL•• •••• 9999"). No bank is
// contacted and no transfers are initiated. Request bodies are never logged.

import { validateBankAccount } from '../_shared/payment-validation.ts'
import { adminClient, authenticate, corsHeaders, json, readJsonObject } from '../_shared/http.ts'

const MAX_ACCOUNTS_PER_USER = 10

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  const admin = adminClient()
  const user = await authenticate(req, admin)
  if (!user) return json({ error: 'NOT_AUTHENTICATED' }, 401)

  const body = await readJsonObject(req)
  if (!body) return json({ error: 'INVALID_REQUEST' }, 400)

  const result = validateBankAccount({
    accountHolderName: body.accountHolderName,
    bankName: body.bankName,
    country: body.country,
    currency: body.currency,
    accountIdentifier: body.accountIdentifier,
  })
  if (!result.ok) return json({ error: 'VALIDATION_FAILED', fields: result.errors }, 400)

  const { count, error: countError } = await admin
    .from('bank_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (countError) return json({ error: 'INTERNAL' }, 500)
  if ((count ?? 0) >= MAX_ACCOUNTS_PER_USER) return json({ error: 'LIMIT_REACHED' }, 409)

  const account = result.value
  const { data, error } = await admin
    .from('bank_accounts')
    .insert({
      user_id: user.id,
      account_holder_name: account.accountHolderName,
      bank_name: account.bankName,
      country: account.country,
      currency: account.currency,
      identifier_type: account.identifierType,
      masked_account_identifier: account.maskedIdentifier,
    })
    .select('id, account_holder_name, bank_name, country, currency, identifier_type, masked_account_identifier, created_at')
    .single()
  if (error) return json({ error: 'INTERNAL' }, 500)

  return json({ account: data }, 201)
})
