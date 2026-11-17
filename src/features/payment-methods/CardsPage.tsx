import { CARD_BRAND_LABELS, type CardBrand } from '@shared/payment-validation'
import { AlertCircle, CreditCard, Info } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { SimulatedBadge } from '@/components/shared/SimulatedBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useCards, useDeleteCard } from './api'
import { AddCardDialog } from './components/AddCardDialog'
import { formatExpiry } from './format'

const BRAND_STYLES: Record<CardBrand, string> = {
  visa: 'from-blue-700 to-indigo-900',
  mastercard: 'from-orange-600 to-rose-800',
  amex: 'from-teal-600 to-cyan-900',
  discover: 'from-amber-500 to-orange-700',
  other: 'from-slate-600 to-slate-900',
}

export function CardsPage() {
  const cards = useCards()
  const remove = useDeleteCard()

  return (
    <>
      <PageHeader title="Payment Cards" description="Manage your simulated payment cards." actions={<AddCardDialog />} />

      <Alert className="mb-6">
        <Info />
        <AlertDescription>
          Cards in DummyPay are simulated. They are not connected to any payment processor and have not been verified
          by a financial institution.
        </AlertDescription>
      </Alert>

      {cards.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : cards.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>We couldn't load your cards. Please refresh the page.</AlertDescription>
        </Alert>
      ) : cards.data.length === 0 ? (
        <EmptyState icon={CreditCard} title="No cards yet" description="Add a simulated card to see it here." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.data.map((c) => {
            const brand = c.card_brand as CardBrand
            return (
              <li key={c.id} className="space-y-2" data-testid="card-item">
                <div
                  className={cn(
                    'flex aspect-[1.586] flex-col justify-between rounded-2xl bg-gradient-to-br p-5 text-white shadow-md',
                    BRAND_STYLES[brand],
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-semibold">{CARD_BRAND_LABELS[brand]}</span>
                    <SimulatedBadge className="border-white/40 bg-white/15 text-white" />
                  </div>
                  <p className="font-mono text-lg tracking-widest" aria-label={`Card ending in ${c.last_four_digits}`}>
                    •••• •••• •••• {c.last_four_digits}
                  </p>
                  <div className="flex items-end justify-between text-xs">
                    <span className="truncate uppercase">{c.cardholder_name}</span>
                    <span>Exp {formatExpiry(c.expiration_month, c.expiration_year)}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <ConfirmDeleteButton
                    label={`Remove card ending in ${c.last_four_digits}`}
                    title={`Remove card ending in ${c.last_four_digits}?`}
                    description="This simulated card will be removed from your account."
                    disabled={remove.isPending}
                    onConfirm={() =>
                      remove.mutate(c.id, {
                        onSuccess: () => toast.success('Card removed.'),
                        onError: () => toast.error('Could not remove the card. Please try again.'),
                      })
                    }
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
