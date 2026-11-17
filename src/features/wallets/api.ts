import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/context'
import { profileKey } from '@/features/profile/api'
import type { CurrencyCode } from '@/lib/money'
import { supabase } from '@/lib/supabase'

export const walletsKey = (userId: string) => ['wallets', userId] as const
export const walletSummaryKey = (userId: string) => ['wallet-summary', userId] as const

/** Read-only: balances are only ever changed by server-side functions. */
export async function fetchWallets() {
  const { data, error } = await supabase
    .from('wallets')
    .select('id, currency, balance_minor, created_at, updated_at')
    .order('created_at')
  if (error) throw error
  return data
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({ queryKey: walletsKey(userId), queryFn: fetchWallets })
}

/** Server-computed approximate total in the preferred currency. */
export function useWalletSummary() {
  const userId = useUserId()
  return useQuery({
    queryKey: walletSummaryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_wallet_summary').single()
      if (error) throw error
      return data
    },
  })
}

function useInvalidateWalletData() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: walletsKey(userId) }),
      queryClient.invalidateQueries({ queryKey: walletSummaryKey(userId) }),
      queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
    ])
}

/** Opens a 0-balance wallet (server-side; duplicates are rejected). */
export function useAddWallet() {
  const invalidate = useInvalidateWalletData()
  return useMutation({
    mutationFn: async (currency: CurrencyCode) => {
      const { data, error } = await supabase.rpc('add_wallet', { p_currency: currency })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

/** Changes the preferred currency; the server opens a 0-balance wallet if needed. */
export function useSetPreferredCurrency() {
  const invalidate = useInvalidateWalletData()
  return useMutation({
    mutationFn: async (currency: CurrencyCode) => {
      const { data, error } = await supabase.rpc('set_preferred_currency', { p_currency: currency })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}
