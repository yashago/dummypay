import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/lib/money'
import { useWalletSummary } from '../api'

/** Approximate total across all wallets, converted server-side to the preferred currency. */
export function TotalBalanceCard() {
  const summary = useWalletSummary()
  const s = summary.data

  return (
    <Card className="bg-primary text-primary-foreground" data-testid="total-balance">
      <CardHeader>
        <CardDescription className="text-primary-foreground/80">
          Total balance{s && s.wallet_count > 1 ? ' (approximate)' : ''}
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {summary.isPending ? (
            <Skeleton className="h-9 w-48 bg-primary-foreground/20" />
          ) : !s || s.total_minor === null || s.preferred_currency === null ? (
            'Unavailable'
          ) : (
            <>
              {s.wallet_count > 1 && '≈ '}
              {formatMoney(s.total_minor, s.preferred_currency)}
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-primary-foreground/80">
        {s
          ? `${s.wallet_count} wallet${s.wallet_count === 1 ? '' : 's'} · shown in ${s.preferred_currency}`
          : ' '}
        {s?.total_minor === null && s.wallet_count > 1 && ' · exchange rates unavailable'}
      </CardContent>
    </Card>
  )
}
