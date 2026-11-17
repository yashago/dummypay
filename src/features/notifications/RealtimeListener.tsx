import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/context'
import { walletsKey, walletSummaryKey } from '@/features/wallets/api'
import { formatMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import type { Notification } from './api'
import { IncomingPaymentDialog } from './components/IncomingPaymentDialog'

/**
 * One Realtime channel per signed-in user. Postgres changes are filtered by
 * user_id and, independently, by RLS on the server — other users' rows are
 * never delivered. Mounted inside the protected layout, so it unsubscribes on
 * sign-out.
 */
export function RealtimeListener() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const [incoming, setIncoming] = useState<Notification[]>([])

  useEffect(() => {
    const refreshFinancialData = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: walletsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: walletSummaryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['transactions', userId] }),
        queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
      ])

    const channel = supabase
      .channel(`user:${userId}`)
      // The DB listener is live only after this system message. Refetch then
      // (also after reconnects) so nothing that happened meanwhile is missed.
      .on('system', {}, (msg: { extension?: string; status?: string }) => {
        if (msg.extension === 'postgres_changes' && msg.status === 'ok') void refreshFinancialData()
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification
          setIncoming((queue) => [...queue, n])
          toast.success(`${n.sender_display_name} sent you ${formatMoney(n.amount_minor, n.currency)}`)
          void refreshFinancialData()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: walletsKey(userId) })
          void queryClient.invalidateQueries({ queryKey: walletSummaryKey(userId) })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  return (
    <IncomingPaymentDialog
      notification={incoming[0] ?? null}
      remaining={Math.max(0, incoming.length - 1)}
      onClose={() => setIncoming((queue) => queue.slice(1))}
    />
  )
}
