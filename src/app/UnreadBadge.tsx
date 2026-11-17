import { useUnreadCount } from '@/features/notifications/api'

/** Unread-notification count shown next to the Notifications nav item. */
export function UnreadBadge() {
  const { data } = useUnreadCount()
  if (!data) return null
  return (
    <span
      className="ml-auto min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs leading-5 font-semibold text-white"
      data-testid="unread-badge"
    >
      {data > 99 ? '99+' : data}
      <span className="sr-only"> unread</span>
    </span>
  )
}
