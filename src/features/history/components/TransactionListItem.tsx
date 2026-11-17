import { ArrowDownLeft, ArrowUpRight, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HistoryRow } from '../api'
import { signedAmount, transactionTitle } from '../format'

export function TransactionListItem({ t, onSelect }: { t: HistoryRow; onSelect: (t: HistoryRow) => void }) {
  const Icon = t.type === 'initial_grant' ? Gift : t.direction === 'sent' ? ArrowUpRight : ArrowDownLeft
  const amount = signedAmount(t)

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(t)}
        className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
        data-testid="transaction-row"
      >
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full',
            t.direction === 'sent' ? 'bg-muted text-foreground' : 'bg-emerald-100 text-emerald-700',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{transactionTitle(t)}</span>
          <span className="block text-xs text-muted-foreground">
            {t.direction === 'sent' ? 'Sent' : 'Received'} ·{' '}
            {new Date(t.created_at!).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </span>
        <span
          className={cn('text-sm font-semibold tabular-nums', amount.positive && 'text-emerald-700')}
        >
          {amount.text}
        </span>
      </button>
    </li>
  )
}
