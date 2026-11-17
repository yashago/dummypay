import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { CurrencyCode } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type AmountSide = Database['public']['Enums']['amount_side']

/** Rates older than this (by our fetch time) trigger a background refresh request. */
const REFRESH_AFTER_MS = 60 * 60 * 1000
/** Mirrors public.fx_max_age(): older provider data can't be used for money movement. */
export const RATE_MAX_AGE_MS = 26 * 60 * 60 * 1000

export const fxKeys = {
  rates: ['fx', 'rates'] as const,
  status: ['fx', 'status'] as const,
  preview: (args: unknown) => ['fx', 'preview', args] as const,
}

export async function fetchCrossRates() {
  const { data, error } = await supabase
    .from('fx_cross_rates')
    .select('from_currency, to_currency, rate, provider_updated_at, fetched_at, provider')
  if (error) throw error
  return data
}

export function useCrossRates() {
  return useQuery({ queryKey: fxKeys.rates, queryFn: fetchCrossRates, staleTime: 5 * 60 * 1000 })
}

export function useFxStatus() {
  return useQuery({
    queryKey: fxKeys.status,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fx_status')
        .select('last_attempt_at, last_success_at, last_error')
        .single()
      if (error) throw error
      return data
    },
    staleTime: 60 * 1000,
  })
}

/**
 * Asks the server to refresh rates when ours look old. The Edge Function holds
 * the API key and throttles provider calls, so calling it often is harmless.
 */
export function useEnsureFreshRates() {
  const queryClient = useQueryClient()
  const rates = useCrossRates()
  const newestFetch = rates.isSuccess
    ? rates.data.reduce<number>((max, r) => Math.max(max, r.fetched_at ? Date.parse(r.fetched_at) : 0), 0)
    : null

  useEffect(() => {
    if (newestFetch === null) return
    if (newestFetch && Date.now() - newestFetch <= REFRESH_AFTER_MS) return
    let cancelled = false
    supabase.functions
      .invoke('fx-refresh', { method: 'POST' })
      .catch(() => undefined) // failures are surfaced via fx_status
      .finally(() => {
        if (cancelled) return
        queryClient.invalidateQueries({ queryKey: ['fx'] })
        queryClient.invalidateQueries({ queryKey: ['wallet-summary'] })
      })
    return () => {
      cancelled = true
    }
  }, [newestFetch, queryClient])
}

export type PreviewArgs = {
  amountMinor: number
  from: CurrencyCode
  to: CurrencyCode
  side: AmountSide
}

/** Server-computed conversion preview (no financial maths in the browser). */
export function useConversionPreview(args: PreviewArgs | null) {
  return useQuery({
    queryKey: fxKeys.preview(args),
    enabled: !!args,
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('preview_conversion', {
          p_amount_minor: args!.amountMinor,
          p_from: args!.from,
          p_to: args!.to,
          p_side: args!.side,
        })
        .single()
      if (error) throw error
      return data
    },
  })
}

export function isRateStale(providerUpdatedAt: string | null | undefined): boolean {
  return !providerUpdatedAt || Date.now() - Date.parse(providerUpdatedAt) > RATE_MAX_AGE_MS
}
