import { AlertCircle, Clock, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useCountdown } from '@/hooks/use-countdown'
import { rpcErrorCode, rpcErrorMessage } from '@/lib/errors'
import { formatMoney, formatRate } from '@/lib/money'
import type { Quote } from '../api'

type Props = {
  quote: Quote
  sender: { displayName: string; email: string }
  executing: boolean
  error: unknown
  refreshing: boolean
  onConfirm: () => void
  onRefresh: () => void
  onBack: () => void
}

function Row({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium" data-testid={testId}>
        {children}
      </dd>
    </div>
  )
}

export function ReviewStep({ quote, sender, executing, error, refreshing, onConfirm, onRefresh, onBack }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const remaining = useCountdown(quote.expires_at)
  const expired = remaining === 0 || rpcErrorCode(error) === 'QUOTE_EXPIRED'
  const sameCurrency = quote.sending_currency === quote.receiving_currency

  const send = formatMoney(quote.sending_amount_minor!, quote.sending_currency!)
  const receive = formatMoney(quote.receiving_amount_minor!, quote.receiving_currency!)

  return (
    <div className="space-y-5">
      <dl className="divide-y rounded-lg border px-4" data-testid="transfer-summary">
        <Row label="From">
          {sender.displayName}
          <br />
          <span className="font-normal text-muted-foreground">{sender.email}</span>
        </Row>
        <Row label="To">
          {quote.recipient_display_name}
          <br />
          <span className="font-normal text-muted-foreground">{quote.recipient_email}</span>
        </Row>
        <Row label="You send" testId="summary-send">
          {send}
        </Row>
        <Row label="Sending currency">{quote.sending_currency}</Row>
        <Row label="Exchange rate" testId="summary-rate">
          {sameCurrency
            ? 'No conversion (same currency)'
            : `1 ${quote.sending_currency} = ${formatRate(quote.exchange_rate!)} ${quote.receiving_currency}`}
        </Row>
        <Row label="Recipient gets" testId="summary-receive">
          <span className="text-base">{receive}</span>
        </Row>
      </dl>

      {!sameCurrency && quote.rate_provider_updated_at && (
        <p className="text-xs text-muted-foreground">
          Rate published {new Date(quote.rate_provider_updated_at).toLocaleString()}. Amounts are rounded to the
          nearest {quote.receiving_currency === 'ILS' ? 'agora' : 'cent'}.
        </p>
      )}

      {expired ? (
        <Alert>
          <Clock />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            This quote has expired. Get a new quote to continue.
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? <Spinner /> : <RefreshCw />} Get new quote
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
          <Clock className="size-4" /> Quote valid for {remaining}s
        </p>
      )}

      {Boolean(error) && !expired && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            {rpcErrorCode(error) ? rpcErrorMessage(error) : 'Network problem — you can safely try again; you will not be charged twice.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={executing}>
          Back
        </Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={expired || executing}>
          {executing && <Spinner />}
          Confirm & send
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send {send} to {quote.recipient_display_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {quote.recipient_display_name} will receive {receive}. Transfers can't be reversed. All funds
              are fictional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false)
                onConfirm()
              }}
            >
              Send now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
