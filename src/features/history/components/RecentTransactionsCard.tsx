import { History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EMPTY_FILTERS, useTransactions, type HistoryRow } from '../api'
import { TransactionDetailDialog } from './TransactionDetailDialog'
import { TransactionListItem } from './TransactionListItem'

export function RecentTransactionsCard() {
  const query = useTransactions(EMPTY_FILTERS, 0, 5)
  const [selected, setSelected] = useState<HistoryRow | null>(null)

  return (
    <Card data-testid="recent-transactions">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardAction>
          <Button variant="link" size="sm" asChild>
            <Link to="/history">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : query.isError || query.data.rows.length === 0 ? (
          <EmptyState icon={History} title="No transactions yet" />
        ) : (
          <ul className="divide-y">
            {query.data.rows.map((t) => (
              <TransactionListItem key={t.id} t={t} onSelect={setSelected} />
            ))}
          </ul>
        )}
      </CardContent>
      <TransactionDetailDialog t={selected} onClose={() => setSelected(null)} />
    </Card>
  )
}
