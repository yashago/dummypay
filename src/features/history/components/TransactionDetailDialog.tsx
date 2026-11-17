import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMoney, formatRate } from '@/lib/money'
import type { HistoryRow } from '../api'
import { signedAmount, transactionTitle } from '../format'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{children}</dd>
    </div>
  )
}

export function TransactionDetailDialog({ t, onClose }: { t: HistoryRow | null; onClose: () => void }) {
  return (
    <Dialog open={!!t} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {t && (
          <>
            <DialogHeader>
              <DialogTitle>{transactionTitle(t)}</DialogTitle>
              <DialogDescription className="text-2xl font-semibold text-foreground tabular-nums">
                {signedAmount(t).text}
              </DialogDescription>
            </DialogHeader>
            <dl className="divide-y" data-testid="transaction-detail">
              <Row label="Transaction ID">
                <span className="font-mono text-xs">{t.id}</span>
              </Row>
              <Row label="Date & time">
                {new Date(t.created_at!).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' })}
              </Row>
              <Row label="Type">
                {t.type === 'initial_grant' ? 'Welcome credit' : t.direction === 'sent' ? 'Sent' : 'Received'}
              </Row>
              <Row label="Status">
                <Badge variant="secondary" className="capitalize">
                  {t.status}
                </Badge>
              </Row>
              {t.type === 'transfer' && (
                <Row label="Sender">
                  {t.sender_display_name}
                  <br />
                  <span className="text-muted-foreground">{t.sender_email}</span>
                </Row>
              )}
              <Row label="Recipient">
                {t.recipient_display_name}
                <br />
                <span className="text-muted-foreground">{t.recipient_email}</span>
              </Row>
              {t.type === 'transfer' && (
                <>
                  <Row label="Amount sent">{formatMoney(t.sending_amount_minor!, t.sending_currency!)}</Row>
                  <Row label="Sending currency">{t.sending_currency}</Row>
                </>
              )}
              <Row label="Amount received">
                {formatMoney(t.receiving_amount_minor!, t.receiving_currency!)} ({t.receiving_currency})
              </Row>
              {t.type === 'transfer' && t.sending_currency !== t.receiving_currency && (
                <Row label="Exchange rate">
                  1 {t.sending_currency} = {formatRate(t.exchange_rate!)} {t.receiving_currency}
                  {t.rate_provider_updated_at && (
                    <span className="block text-xs text-muted-foreground">
                      Rate published {new Date(t.rate_provider_updated_at).toLocaleString()}
                    </span>
                  )}
                </Row>
              )}
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
