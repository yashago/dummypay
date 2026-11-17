import { BANK_COUNTRIES, validateBankAccount } from '@shared/payment-validation'
import { AlertCircle, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CurrencySelect } from '@/components/shared/CurrencySelect'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import type { CurrencyCode } from '@/lib/money'
import { FunctionError, functionErrorMessage, useAddBankAccount, type BankForm } from '../api'

const EMPTY: BankForm = { accountHolderName: '', bankName: '', country: '', currency: '', accountIdentifier: '' }

export function AddBankAccountDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BankForm>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof BankForm, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const addAccount = useAddBankAccount()

  const country = BANK_COUNTRIES.find((c) => c.code === form.country)
  const set = (key: keyof BankForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setForm(EMPTY)
      setErrors({})
      setFormError(null)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const check = validateBankAccount(form)
    if (!check.ok) return setErrors(check.errors)
    setErrors({})
    try {
      await addAccount.mutateAsync(form)
      toast.success('Simulated bank account added.')
      close(false)
    } catch (err) {
      if (err instanceof FunctionError) setErrors(err.fields as typeof errors)
      setFormError(functionErrorMessage(err, 'bank account'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add bank account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a simulated bank account</DialogTitle>
          <DialogDescription>
            Not connected to any bank. No real transfers are made. Only a masked account number is stored.
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
            <Field data-invalid={!!errors.accountHolderName}>
              <FieldLabel htmlFor="bank-holder">Account holder name</FieldLabel>
              <Input
                id="bank-holder"
                value={form.accountHolderName}
                onChange={(e) => set('accountHolderName')(e.target.value)}
                aria-invalid={!!errors.accountHolderName}
              />
              <FieldError>{errors.accountHolderName}</FieldError>
            </Field>
            <Field data-invalid={!!errors.bankName}>
              <FieldLabel htmlFor="bank-name">Bank name</FieldLabel>
              <Input
                id="bank-name"
                value={form.bankName}
                onChange={(e) => set('bankName')(e.target.value)}
                aria-invalid={!!errors.bankName}
              />
              <FieldError>{errors.bankName}</FieldError>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.country}>
                <FieldLabel htmlFor="bank-country">Country</FieldLabel>
                <Select value={form.country} onValueChange={set('country')}>
                  <SelectTrigger id="bank-country" className="w-full" aria-invalid={!!errors.country}>
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{errors.country}</FieldError>
              </Field>
              <Field data-invalid={!!errors.currency}>
                <FieldLabel htmlFor="bank-currency">Currency</FieldLabel>
                <CurrencySelect
                  id="bank-currency"
                  value={(form.currency || undefined) as CurrencyCode | undefined}
                  onChange={set('currency')}
                  showName={false}
                />
                <FieldError>{errors.currency}</FieldError>
              </Field>
            </div>
            <Field data-invalid={!!errors.accountIdentifier}>
              <FieldLabel htmlFor="bank-identifier">IBAN or account number</FieldLabel>
              <Input
                id="bank-identifier"
                autoComplete="off"
                value={form.accountIdentifier}
                onChange={(e) => set('accountIdentifier')(e.target.value.toUpperCase())}
                aria-invalid={!!errors.accountIdentifier}
              />
              {errors.accountIdentifier ? (
                <FieldError>{errors.accountIdentifier}</FieldError>
              ) : (
                <FieldDescription>
                  {country?.iban
                    ? `${country.name} IBANs have ${country.iban} characters, or enter a 4–20 digit account number.`
                    : 'Enter a 4–20 digit account number.'}
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addAccount.isPending}>
              {addAccount.isPending && <Spinner />}
              Add bank account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
