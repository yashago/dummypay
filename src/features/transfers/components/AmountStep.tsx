import { AlertCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { rpcErrorMessage } from '@/lib/errors'
import { formatMoney, parseAmountToMinor, type CurrencyCode } from '@/lib/money'
import {
  useCreateQuote,
  type AmountSide,
  type Quote,
  type QuoteRequest,
  type Recipient,
} from '../api'

type Wallet = { currency: CurrencyCode; balance_minor: number }
type Props = {
  recipient: Recipient
  wallets: Wallet[]
  onBack: () => void
  onQuoted: (quote: Quote, request: QuoteRequest) => void
}

export function AmountStep({ recipient, wallets, onBack, onQuoted }: Props) {
  const funded = wallets.filter((w) => w.balance_minor > 0)
  const [sending, setSending] = useState<CurrencyCode | undefined>(
    (funded.find((w) => w.currency === recipient.preferredCurrency) ?? funded[0])?.currency,
  )
  const [side, setSide] = useState<AmountSide>('send')
  const [amount, setAmount] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const createQuote = useCreateQuote()

  const wallet = wallets.find((w) => w.currency === sending)
  const amountCurrency = side === 'send' ? sending : recipient.preferredCurrency

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!sending || !wallet || !amountCurrency) return
    const parsed = parseAmountToMinor(amount, amountCurrency)
    if (!parsed.ok) return setInputError(parsed.error)
    if (side === 'send' && parsed.minor > wallet.balance_minor) {
      return setInputError(`You only have ${formatMoney(wallet.balance_minor, sending)} available.`)
    }
    setInputError(null)
    const request = { recipientId: recipient.userId, sendingCurrency: sending, amountMinor: parsed.minor, side }
    try {
      onQuoted(await createQuote.mutateAsync(request), request)
    } catch {
      // shown below via createQuote.error
    }
  }

  if (funded.length === 0) {
    return (
      <Alert>
        <AlertCircle />
        <AlertDescription>You have no funds available to send.</AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field>
        <FieldLabel htmlFor="sending-wallet">Send from</FieldLabel>
        <Select value={sending} onValueChange={(v) => setSending(v as CurrencyCode)}>
          <SelectTrigger id="sending-wallet" className="w-full">
            <SelectValue placeholder="Choose a wallet" />
          </SelectTrigger>
          <SelectContent>
            {funded.map((w) => (
              <SelectItem key={w.currency} value={w.currency}>
                {w.currency} wallet — {formatMoney(w.balance_minor, w.currency)} available
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          {recipient.displayName} receives in {recipient.preferredCurrency}.
          {sending && sending !== recipient.preferredCurrency && ' The amount will be converted at the current rate.'}
        </FieldDescription>
      </Field>

      <SegmentedControl
        label="Amount is"
        className="w-full"
        value={side}
        onChange={setSide}
        options={[
          { value: 'send', label: 'I send' },
          { value: 'receive', label: 'Recipient gets' },
        ]}
      />

      <Field data-invalid={!!inputError}>
        <FieldLabel htmlFor="transfer-amount">
          Amount {side === 'send' ? 'to send' : 'they receive'} ({amountCurrency})
        </FieldLabel>
        <Input
          id="transfer-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={!!inputError}
        />
        {inputError && <FieldError>{inputError}</FieldError>}
      </Field>

      {createQuote.isError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{rpcErrorMessage(createQuote.error)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={createQuote.isPending || !sending}>
          {createQuote.isPending && <Spinner />}
          Review transfer
        </Button>
      </div>
    </form>
  )
}
