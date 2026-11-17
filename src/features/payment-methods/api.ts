import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/context'
import { supabase } from '@/lib/supabase'

/** Error thrown by our Edge Functions: a code plus optional per-field messages. */
export class FunctionError extends Error {
  readonly code: string
  readonly fields: Record<string, string>
  constructor(code: string, fields: Record<string, string> = {}) {
    super(code)
    this.code = code
    this.fields = fields
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => ({}))) as {
        error?: string
        fields?: Record<string, string>
      }
      throw new FunctionError(payload.error ?? 'INTERNAL', payload.fields)
    }
    throw new FunctionError('NETWORK')
  }
  return data as T
}

export function functionErrorMessage(err: unknown, noun: string): string {
  const code = err instanceof FunctionError ? err.code : 'INTERNAL'
  switch (code) {
    case 'VALIDATION_FAILED':
      return 'Please correct the highlighted fields.'
    case 'LIMIT_REACHED':
      return `You can add up to 10 ${noun}s. Remove one to add another.`
    case 'NOT_AUTHENTICATED':
      return 'Your session has expired. Please sign in again.'
    case 'NETWORK':
      return 'Network problem. Please check your connection and try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

// -----------------------------------------------------------------------------
// Cards
// -----------------------------------------------------------------------------
export const cardsKey = (userId: string) => ['payment-cards', userId] as const

export function useCards() {
  const userId = useUserId()
  return useQuery({
    queryKey: cardsKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_cards')
        .select('id, cardholder_name, card_brand, last_four_digits, expiration_month, expiration_year, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export type CardForm = { cardholderName: string; cardNumber: string; expiry: string; cvv: string }

/** The full number and CVV go only to the add-payment-card Edge Function. */
export function useAddCard() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (form: CardForm) => invoke('add-payment-card', form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardsKey(userId) }),
  })
}

export function useDeleteCard() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_cards').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardsKey(userId) }),
  })
}

// -----------------------------------------------------------------------------
// Bank accounts
// -----------------------------------------------------------------------------
export const bankAccountsKey = (userId: string) => ['bank-accounts', userId] as const

export function useBankAccounts() {
  const userId = useUserId()
  return useQuery({
    queryKey: bankAccountsKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, account_holder_name, bank_name, country, currency, identifier_type, masked_account_identifier, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export type BankForm = {
  accountHolderName: string
  bankName: string
  country: string
  currency: string
  accountIdentifier: string
}

export function useAddBankAccount() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (form: BankForm) => invoke('add-bank-account', form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bankAccountsKey(userId) }),
  })
}

export function useDeleteBankAccount() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bankAccountsKey(userId) }),
  })
}
