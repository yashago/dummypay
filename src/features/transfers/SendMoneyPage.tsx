import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/features/profile/api'
import { useWallets } from '@/features/wallets/api'
import { rpcErrorCode, rpcErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useCreateQuote, useExecuteTransfer, type Quote, type QuoteRequest, type Recipient } from './api'
import { AmountStep } from './components/AmountStep'
import { RecipientStep } from './components/RecipientStep'
import { ReviewStep } from './components/ReviewStep'
import { SuccessStep } from './components/SuccessStep'

type Step = 'recipient' | 'amount' | 'review' | 'done'
const STEPS: { id: Step; label: string }[] = [
  { id: 'recipient', label: 'Recipient' },
  { id: 'amount', label: 'Amount' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
]

const DESCRIPTIONS: Record<Step, string> = {
  recipient: 'Enter the email address of a registered DummyPay user.',
  amount: 'Choose the wallet to send from and how much.',
  review: 'Check the details. Nothing is sent until you confirm.',
  done: '',
}

export function SendMoneyPage() {
  const profile = useProfile()
  const wallets = useWallets()
  const createQuote = useCreateQuote()
  const execute = useExecuteTransfer()

  const [step, setStep] = useState<Step>('recipient')
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [request, setRequest] = useState<QuoteRequest | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  // One idempotency key per reviewed quote; reused for retries of that quote.
  const [idempotencyKey, setIdempotencyKey] = useState<string>('')

  const acceptQuote = (q: Quote, req: QuoteRequest) => {
    setQuote(q)
    setRequest(req)
    setIdempotencyKey(crypto.randomUUID())
    execute.reset()
    setStep('review')
  }

  const refreshQuote = async () => {
    if (!request) return
    try {
      acceptQuote(await createQuote.mutateAsync(request), request)
    } catch (err) {
      toast.error(rpcErrorMessage(err))
    }
  }

  const confirm = async () => {
    if (!quote?.quote_id || execute.isPending) return
    try {
      await execute.mutateAsync({ quoteId: quote.quote_id, idempotencyKey })
      setStep('done')
      toast.success('Transfer complete.')
    } catch (err) {
      if (rpcErrorCode(err) === 'INSUFFICIENT_FUNDS') toast.error(rpcErrorMessage(err))
    }
  }

  const reset = () => {
    setStep('recipient')
    setRecipient(null)
    setQuote(null)
    setRequest(null)
    execute.reset()
  }

  const currentIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <>
      <PageHeader title="Send Money" description="Transfer fictional funds to another registered user." />

      <ol className="mb-6 flex gap-2 text-xs sm:text-sm" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            aria-current={s.id === step ? 'step' : undefined}
            className={cn(
              'flex-1 rounded-full border px-3 py-1.5 text-center',
              i < currentIndex && 'border-primary/30 bg-primary/10 text-primary',
              i === currentIndex && 'border-primary bg-primary text-primary-foreground',
              i > currentIndex && 'text-muted-foreground',
            )}
          >
            {s.label}
          </li>
        ))}
      </ol>

      <Card className="max-w-2xl">
        {step !== 'done' && (
          <CardHeader>
            <CardTitle>{STEPS[currentIndex].label}</CardTitle>
            <CardDescription>{DESCRIPTIONS[step]}</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          {step === 'recipient' && (
            <RecipientStep
              initial={recipient}
              onContinue={(r) => {
                setRecipient(r)
                setStep('amount')
              }}
            />
          )}

          {step === 'amount' &&
            recipient &&
            (wallets.isPending ? (
              <Skeleton className="h-48" />
            ) : (
              <AmountStep
                recipient={recipient}
                wallets={wallets.data ?? []}
                onBack={() => setStep('recipient')}
                onQuoted={acceptQuote}
              />
            ))}

          {step === 'review' && quote && profile.data && (
            <ReviewStep
              quote={quote}
              sender={{ displayName: profile.data.display_name, email: profile.data.email }}
              executing={execute.isPending}
              error={execute.error}
              refreshing={createQuote.isPending}
              onConfirm={confirm}
              onRefresh={refreshQuote}
              onBack={() => setStep('amount')}
            />
          )}

          {step === 'done' && execute.data && <SuccessStep txn={execute.data} onSendAnother={reset} />}
        </CardContent>
      </Card>
    </>
  )
}
