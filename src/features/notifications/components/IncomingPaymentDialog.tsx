import { ArrowDownLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMoney } from '@/lib/money'
import { useMarkNotificationsRead, type Notification } from '../api'

type Props = { notification: Notification | null; remaining: number; onClose: () => void }

export function IncomingPaymentDialog({ notification: n, remaining, onClose }: Props) {
  const navigate = useNavigate()
  const markRead = useMarkNotificationsRead()

  return (
    <Dialog open={!!n} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="incoming-payment">
        {n && (
          <>
            <DialogHeader className="items-center text-center">
              <div className="mb-2 grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <ArrowDownLeft className="size-6" aria-hidden />
              </div>
              <DialogTitle>Payment received</DialogTitle>
              <DialogDescription>
                {n.sender_display_name} ({n.sender_email}) sent you
              </DialogDescription>
              <p className="text-3xl font-semibold tabular-nums" data-testid="incoming-amount">
                {formatMoney(n.amount_minor, n.currency)}
              </p>
              <p className="text-sm text-muted-foreground">
                Credited to your {n.currency} wallet · fictional funds
              </p>
              {remaining > 0 && (
                <p className="text-xs text-muted-foreground">
                  +{remaining} more payment{remaining === 1 ? '' : 's'}
                </p>
              )}
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  markRead.mutate([n.id])
                  onClose()
                }}
              >
                Mark as read
              </Button>
              <Button
                onClick={() => {
                  onClose()
                  navigate('/history')
                }}
              >
                View transaction
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
