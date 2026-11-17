import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/context'
import { walletsKey, walletSummaryKey } from '@/features/wallets/api'
import type { CurrencyCode } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type AmountSide = Database['public']['Enums']['amount_side']
export type Quote = Database['public']['CompositeTypes']['transfer_quote_view']
export type Recipient = {
  userId: string
  displayName: string
  email: string
  preferredCurrency: CurrencyCode
}

export type LookupResult =
  | { status: 'found'; recipient: Recipient }
  | { status: 'not_found' }
  | { status: 'self' }

/** Backend lookup: returns only name, email and receiving currency. */
export async function lookupRecipient(email: string): Promise<LookupResult> {
  const { data, error } = await supabase.rpc('lookup_recipient', { p_email: email })
  if (error) throw error
  const row = data?.[0]
  if (row?.status === 'found' && row.user_id && row.display_name && row.email && row.preferred_currency) {
    return {
      status: 'found',
      recipient: {
        userId: row.user_id,
        displayName: row.display_name,
        email: row.email,
        preferredCurrency: row.preferred_currency,
      },
    }
  }
  return { status: row?.status === 'self' ? 'self' : 'not_found' }
}

export function useLookupRecipient() {
  return useMutation({ mutationFn: lookupRecipient })
}

export type QuoteRequest = {
  recipientId: string
  sendingCurrency: CurrencyCode
  amountMinor: number
  side: AmountSide
}

/** Server-priced quote; the summary shows exactly what will be executed. */
export function useCreateQuote() {
  return useMutation({
    mutationFn: async (req: QuoteRequest): Promise<Quote> => {
      const { data, error } = await supabase.rpc('create_transfer_quote', {
        p_recipient_id: req.recipientId,
        p_sending_currency: req.sendingCurrency,
        p_amount_minor: req.amountMinor,
        p_input_side: req.side,
      })
      if (error) throw error
      return data
    },
  })
}

/**
 * Executes a quote. The idempotency key is generated once per reviewed quote
 * and reused on retries, so a double-click or network retry can't pay twice.
 */
export function useExecuteTransfer() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ quoteId, idempotencyKey }: { quoteId: string; idempotencyKey: string }) => {
      const { data, error } = await supabase.rpc('execute_transfer', {
        p_quote_id: quoteId,
        p_idempotency_key: idempotencyKey,
      })
      if (error) throw error
      return data
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: walletsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: walletSummaryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['transactions', userId] }),
      ]),
  })
}
