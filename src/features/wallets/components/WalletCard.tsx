import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CURRENCY_NAMES, formatMoney, type CurrencyCode } from '@/lib/money'

type Props = { currency: CurrencyCode; balanceMinor: number; preferred?: boolean }

export function WalletCard({ currency, balanceMinor, preferred }: Props) {
  return (
    <Card data-testid={`wallet-${currency}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {currency} · {CURRENCY_NAMES[currency]}
        </CardTitle>
        {preferred && <Badge variant="secondary">Preferred</Badge>}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">Available balance</p>
        <p className="text-2xl font-semibold tabular-nums">{formatMoney(balanceMinor, currency)}</p>
      </CardContent>
    </Card>
  )
}
