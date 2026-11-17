import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import type { Database } from '@/types/database'

type Txn = Database['public']['Tables']['transactions']['Row']

export function SuccessStep({ txn, onSendAnother }: { txn: Txn; onSendAnother: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center" data-testid="transfer-success">
      <CheckCircle2 className="mb-3 size-12 text-emerald-600" aria-hidden />
      <h2 className="text-xl font-semibold">Transfer complete</h2>
      <p className="mt-1 text-muted-foreground">
        You sent {formatMoney(txn.sending_amount_minor!, txn.sending_currency!)} to{' '}
        {txn.recipient_display_name}. They received{' '}
        {formatMoney(txn.receiving_amount_minor, txn.receiving_currency)}.
      </p>
      <p className="mt-3 font-mono text-xs break-all text-muted-foreground">Transaction ID: {txn.id}</p>
      <div className="mt-6 flex gap-2">
        <Button variant="outline" asChild>
          <Link to="/history">View history</Link>
        </Button>
        <Button onClick={onSendAnother}>Send another</Button>
      </div>
    </div>
  )
}
