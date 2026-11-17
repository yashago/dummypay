import { ArrowDownLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Notification } from '../api'

type Props = { n: Notification; onMarkRead?: (id: string) => void; compact?: boolean }

export function NotificationItem({ n, onMarkRead, compact = false }: Props) {
  return (
    <li
      className={cn('flex items-start gap-3 py-3', !n.is_read && 'font-medium')}
      data-testid="notification-item"
      data-read={n.is_read}
    >
      <span className="relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <ArrowDownLeft className="size-4" aria-hidden />
        {!n.is_read && (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background">
            <span className="sr-only">Unread</span>
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{n.title}</span>
        <span className="block text-sm font-normal break-words text-muted-foreground">{n.message}</span>
        <span className="block text-xs font-normal text-muted-foreground">
          {new Date(n.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </span>
      {!compact && !n.is_read && onMarkRead && (
        <Button variant="ghost" size="sm" onClick={() => onMarkRead(n.id)}>
          <Check /> Mark read
        </Button>
      )}
    </li>
  )
}
