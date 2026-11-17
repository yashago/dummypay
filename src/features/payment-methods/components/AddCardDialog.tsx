import { CARD_BRAND_LABELS, detectCardBrand, validateCard } from '@shared/payment-validation'
import { AlertCircle, Lock, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { FunctionError, functionErrorMessage, useAddCard, type CardForm } from '../api'
import { formatCardNumberInput, formatExpiryInput } from '../format'

const EMPTY: CardForm = { cardholderName: '', cardNumber: '', expiry: '', cvv: '' }

export function AddCardDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CardForm>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof CardForm, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const addCard = useAddCard()

  const digits = form.cardNumber.replace(/\D/g, '')
  const brand = digits.length >= 2 ? detectCardBrand(digits) : null

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Don't keep card details in memory longer than needed.
      setForm(EMPTY)
      setErrors({})
      setFormError(null)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const check = validateCard(form)
    if (!check.ok) return setErrors(check.errors)
    setErrors({})
    try {
      await addCard.mutateAsync(form)
      toast.success('Simulated card added.')
      close(false)
    } catch (err) {
      if (err instanceof FunctionError) setErrors(err.fields as typeof errors)
      setFormError(functionErrorMessage(err, 'card'))
    }
  }

  const set = (key: keyof CardForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a simulated card</DialogTitle>
          <DialogDescription>
            For demonstration only. No payment is authorised and the card is not verified by any financial
            institution.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate autoComplete="off">
          <FieldGroup>
            {formError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!errors.cardholderName}>
              <FieldLabel htmlFor="card-name">Cardholder name</FieldLabel>
              <Input
                id="card-name"
                value={form.cardholderName}
                onChange={(e) => set('cardholderName')(e.target.value)}
                aria-invalid={!!errors.cardholderName}
              />
              <FieldError>{errors.cardholderName}</FieldError>
            </Field>
            <Field data-invalid={!!errors.cardNumber}>
              <FieldLabel htmlFor="card-number">Card number</FieldLabel>
              <Input
                id="card-number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="1234 5678 9012 3456"
                value={form.cardNumber}
                onChange={(e) => set('cardNumber')(formatCardNumberInput(e.target.value))}
                aria-invalid={!!errors.cardNumber}
              />
              {errors.cardNumber ? (
                <FieldError>{errors.cardNumber}</FieldError>
              ) : (
                <FieldDescription>{brand ? CARD_BRAND_LABELS[brand] : 'Visa, Mastercard, Amex, Discover…'}</FieldDescription>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.expiry}>
                <FieldLabel htmlFor="card-expiry">Expiry (MM/YY)</FieldLabel>
                <Input
                  id="card-expiry"
                  inputMode="numeric"
                  placeholder="MM/YY"
                  value={form.expiry}
                  onChange={(e) => set('expiry')(formatExpiryInput(e.target.value))}
                  aria-invalid={!!errors.expiry}
                />
                <FieldError>{errors.expiry}</FieldError>
              </Field>
              <Field data-invalid={!!errors.cvv}>
                <FieldLabel htmlFor="card-cvv">CVV</FieldLabel>
                <Input
                  id="card-cvv"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={form.cvv}
                  onChange={(e) => set('cvv')(e.target.value.replace(/\D/g, ''))}
                  aria-invalid={!!errors.cvv}
                />
                <FieldError>{errors.cvv}</FieldError>
              </Field>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
              Only the brand, last four digits and expiry are saved. The full card number and CVV are checked once
              and never stored.
            </p>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addCard.isPending}>
              {addCard.isPending && <Spinner />}
              Add card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
