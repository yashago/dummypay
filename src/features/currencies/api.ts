import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export async function fetchSupportedCurrencies() {
  const { data, error } = await supabase
    .from('supported_currencies')
    .select('code, name, symbol, minor_units, initial_grant_minor')
    .order('code')
  if (error) throw error
  return data
}

/** Reference data (readable without signing in, for the registration form). */
export function useSupportedCurrencies() {
  return useQuery({
    queryKey: ['supported-currencies'],
    queryFn: fetchSupportedCurrencies,
    staleTime: Infinity,
  })
}
