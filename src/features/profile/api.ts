import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/context'
import { supabase } from '@/lib/supabase'

export const profileKey = (userId: string) => ['profile', userId] as const

/** RLS returns only the caller's own row; the id filter just makes `.single()` explicit. */
export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, preferred_currency, created_at')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({ queryKey: profileKey(userId), queryFn: () => fetchProfile(userId) })
}

/** Only display_name is client-updatable (column-level grant + RLS). */
export function useUpdateDisplayName() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
  })
}
