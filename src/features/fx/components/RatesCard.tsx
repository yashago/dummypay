import { AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRate, type CurrencyCode } from '@/lib/money'
import { isRateStale, useCrossRates, useEnsureFreshRates } from '../api'

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Current rates from the base currency to every other supported currency. */
export function RatesCard({ base }: { base: CurrencyCode }) {
  useEnsureFreshRates()
  const rates = useCrossRates()

  const rows = (rates.data ?? []).filter((r) => r.from_currency === base)
  const updatedAt = rows.reduce<string | null>(
    (min, r) => (r.provider_updated_at && (!min || r.provider_updated_at < min) ? r.provider_updated_at : min),
    null,
  )
  const stale = rows.length > 0 && isRateStale(updatedAt)

  return (
    <Card data-testid="rates-card">
      <CardHeader>
        <CardTitle>Exchange rates</CardTitle>
        <CardDescription>
          {updatedAt ? (
            <>Last updated {formatTimestamp(updatedAt)} · ExchangeRate-API</>
          ) : (
            'Live rates from ExchangeRate-API'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rates.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
          </div>
        ) : rates.isError || rows.length === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title="Exchange rates unavailable"
            description="We couldn't load current rates. Conversions and cross-currency transfers are paused until rates are available."
          />
        ) : (
          <>
            {stale && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>
                  These rates are out of date. Conversions are paused until fresh rates arrive.
                </AlertDescription>
              </Alert>
            )}
            <ul className="divide-y">
              {rows
                .sort((a, b) => (a.to_currency ?? '').localeCompare(b.to_currency ?? ''))
                .map((r) => (
                  <li key={r.to_currency} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-muted-foreground">
                      1 {base} → {r.to_currency}
                    </span>
                    <span className="font-medium tabular-nums" data-testid={`rate-${base}-${r.to_currency}`}>
                      {r.rate !== null ? formatRate(r.rate) : '—'}
                    </span>
                  </li>
                ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
