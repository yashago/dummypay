import { useQuery } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/context'
import { supabase } from '@/lib/supabase'

export const walletsKey = (userId: string) => ['wallets', userId] as const

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
