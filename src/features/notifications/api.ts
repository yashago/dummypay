import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/context'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Notification = Database['public']['Tables']['notifications']['Row']

export const notificationKeys = {
  all: (userId: string) => ['notifications', userId] as const,
  list: (userId: string, unreadOnly: boolean, limit: number) =>
    ['notifications', userId, 'list', unreadOnly, limit] as const,
  unread: (userId: string) => ['notifications', userId, 'unread-count'] as const,
}

export function useNotifications({ unreadOnly = false, limit = 50 } = {}) {
  const userId = useUserId()
  return useQuery({
    queryKey: notificationKeys.list(userId, unreadOnly, limit),
    queryFn: async () => {
      let q = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (unreadOnly) q = q.eq('is_read', false)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useUnreadCount() {
  const userId = useUserId()
  return useQuery({
    queryKey: notificationKeys.unread(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
      if (error) throw error
      return count ?? 0
    },
  })
}

/** Marks specific notifications (or all, when `ids` is omitted) as read. */
export function useMarkNotificationsRead() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const { data, error } = await supabase.rpc('mark_notifications_read', ids ? { p_ids: ids } : {})
      if (error) throw error
      return data
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all(userId) }),
  })
}
