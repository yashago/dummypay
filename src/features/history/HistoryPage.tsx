import { AlertCircle, History, X } from 'lucide-react'
import { useState } from 'react'
import { CurrencySelect } from '@/components/shared/CurrencySelect'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EMPTY_FILTERS, useTransactions, type HistoryFilters, type HistoryRow } from './api'
import { TransactionDetailDialog } from './components/TransactionDetailDialog'
import { TransactionListItem } from './components/TransactionListItem'

const PAGE_SIZE = 20

export function HistoryPage() {
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<HistoryRow | null>(null)
  const query = useTransactions(filters, page, PAGE_SIZE)

  const update = (patch: Partial<HistoryFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }
  const hasFilters = Object.values(filters).some((v) => v !== null)
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <PageHeader title="Transaction History" description="All transfers you've sent and received." />

      <Card className="mb-4">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
          <Field>
            <FieldLabel htmlFor="filter-from">From date</FieldLabel>
            <Input
              id="filter-from"
              type="date"
              value={filters.from ?? ''}
              max={filters.to ?? undefined}
              onChange={(e) => update({ from: e.target.value || null })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-to">To date</FieldLabel>
            <Input
              id="filter-to"
              type="date"
              value={filters.to ?? ''}
              min={filters.from ?? undefined}
              onChange={(e) => update({ to: e.target.value || null })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-type">Type</FieldLabel>
            <Select
              value={filters.direction ?? 'all'}
              onValueChange={(v) => update({ direction: v === 'all' ? null : (v as 'sent' | 'received') })}
            >
              <SelectTrigger id="filter-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-currency">Currency</FieldLabel>
            <div className="flex gap-1">
              <CurrencySelect
                id="filter-currency"
                value={filters.currency ?? undefined}
                onChange={(c) => update({ currency: c })}
                placeholder="All currencies"
                showName={false}
              />
            </div>
          </Field>
          <Button variant="ghost" onClick={() => update(EMPTY_FILTERS)} disabled={!hasFilters}>
            <X /> Clear
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {query.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : query.isError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>We couldn't load your transactions. Please refresh the page.</AlertDescription>
            </Alert>
          ) : query.data.rows.length === 0 ? (
            <EmptyState
              icon={History}
              title={hasFilters ? 'No matching transactions' : 'No transactions yet'}
              description={hasFilters ? 'Try changing or clearing the filters.' : 'Transfers you send or receive will appear here.'}
            />
          ) : (
            <>
              <ul className="divide-y">
                {query.data.rows.map((t) => (
                  <TransactionListItem key={t.id} t={t} onSelect={setSelected} />
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {total} transaction{total === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span>
                    Page {page + 1} of {pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <TransactionDetailDialog t={selected} onClose={() => setSelected(null)} />
    </>
  )
}
