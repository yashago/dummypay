import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/context'
import type { CurrencyCode } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type HistoryRow = Database['public']['Functions']['list_my_transactions']['Returns'][number]

export type HistoryFilters = {
  direction: 'sent' | 'received' | null
  currency: CurrencyCode | null
  from: string | null // yyyy-mm-dd (local)
  to: string | null // yyyy-mm-dd (local, inclusive)
}

export const EMPTY_FILTERS: HistoryFilters = { direction: null, currency: null, from: null, to: null }

/** Local calendar day → UTC instant at local midnight. */
function startOfLocalDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toISOString()
}
function startOfNextLocalDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d + 1).toISOString()
}

export function useTransactions(filters: HistoryFilters, page: number, pageSize = 20) {
  const userId = useUserId()
  return useQuery({
    queryKey: ['transactions', userId, filters, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_transactions', {
        p_direction: filters.direction ?? undefined,
        p_currency: filters.currency ?? undefined,
        p_from: filters.from ? startOfLocalDay(filters.from) : undefined,
        p_to: filters.to ? startOfNextLocalDay(filters.to) : undefined,
        p_limit: pageSize,
        p_offset: page * pageSize,
      })
      if (error) throw error
      return { rows: data, total: data[0]?.total_count ?? 0 }
    },
  })
}
