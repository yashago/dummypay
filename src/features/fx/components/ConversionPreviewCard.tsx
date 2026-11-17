import { ArrowDown, ArrowLeftRight } from 'lucide-react'
import { useState } from 'react'
import { CurrencySelect } from '@/components/shared/CurrencySelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { rpcErrorMessage } from '@/lib/errors'
import { formatMoney, formatRate, parseAmountToMinor, type CurrencyCode } from '@/lib/money'
import { useConversionPreview } from '../api'

/** Lets users preview a conversion; the result is computed by the server. */
export function ConversionPreviewCard({ defaultFrom }: { defaultFrom: CurrencyCode }) {
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState<CurrencyCode>(defaultFrom)
  const [to, setTo] = useState<CurrencyCode>(defaultFrom === 'USD' ? 'EUR' : 'USD')

  const debouncedAmount = useDebouncedValue(amount)
  const parsed = parseAmountToMinor(debouncedAmount, from)
  const preview = useConversionPreview(
    parsed.ok ? { amountMinor: parsed.minor, from, to, side: 'send' } : null,
  )

  const live = parseAmountToMinor(amount, from)
  const inputError = amount.trim() !== '' && !live.ok ? live.error : null

  return (
    <Card data-testid="conversion-preview">
      <CardHeader>
        <CardTitle>Conversion preview</CardTitle>
        <CardDescription>Estimate only — transfers use the rate at confirmation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field data-invalid={!!inputError}>
            <FieldLabel htmlFor="convert-amount">Amount</FieldLabel>
            <Input
              id="convert-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!inputError}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="convert-from">From</FieldLabel>
            <CurrencySelect id="convert-from" value={from} onChange={setFrom} showName={false} className="w-24" />
          </Field>
        </div>
        {inputError && <FieldError>{inputError}</FieldError>}

        <div className="flex items-center justify-between">
          <ArrowDown className="size-4 text-muted-foreground" aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom(to)
              setTo(from)
            }}
          >
            <ArrowLeftRight /> Swap
          </Button>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div className="rounded-lg bg-muted px-3 py-2" aria-live="polite">
            <p className="text-xs text-muted-foreground">Converted amount</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="conversion-result">
              {!parsed.ok || inputError ? (
                '—'
              ) : preview.isFetching && !preview.data ? (
                <Spinner />
              ) : preview.isError ? (
                '—'
              ) : preview.data ? (
                formatMoney(preview.data.receiving_amount_minor, to)
              ) : (
                '—'
              )}
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="convert-to">To</FieldLabel>
            <CurrencySelect id="convert-to" value={to} onChange={setTo} showName={false} className="w-24" />
          </Field>
        </div>

        {preview.isError && parsed.ok && !inputError ? (
          <p role="alert" className="text-sm text-destructive">
            {rpcErrorMessage(preview.error)}
          </p>
        ) : preview.data && !inputError ? (
          <p className="text-xs text-muted-foreground">
            Rate: 1 {from} = {formatRate(preview.data.rate)} {to}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
