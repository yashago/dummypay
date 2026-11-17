import { AlertCircle, Search, UserCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { rpcErrorMessage } from '@/lib/errors'
import { CURRENCY_NAMES } from '@/lib/money'
import { useLookupRecipient, type Recipient } from '../api'

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'))

type Props = { initial?: Recipient | null; onContinue: (recipient: Recipient) => void }

export function RecipientStep({ initial, onContinue }: Props) {
  const [email, setEmail] = useState(initial?.email ?? '')
  const [inputError, setInputError] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [found, setFound] = useState<Recipient | null>(initial ?? null)
  const lookup = useLookupRecipient()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFound(null)
    setLookupError(null)
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setInputError(parsed.error.issues[0].message)
      return
    }
    setInputError(null)
    try {
      const result = await lookup.mutateAsync(parsed.data)
      if (result.status === 'found') setFound(result.recipient)
      else if (result.status === 'self') setLookupError(rpcErrorMessage({ message: 'SELF_TRANSFER' }))
      else setLookupError(rpcErrorMessage({ message: 'RECIPIENT_NOT_FOUND' }))
    } catch (err) {
      setLookupError(rpcErrorMessage(err))
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field data-invalid={!!inputError} className="flex-1">
          <FieldLabel htmlFor="recipient-email">Recipient's email</FieldLabel>
          <Input
            id="recipient-email"
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setFound(null)
            }}
            aria-invalid={!!inputError}
          />
          {inputError ? (
            <FieldError>{inputError}</FieldError>
          ) : (
            <FieldDescription>Transfers are only possible to registered DummyPay users.</FieldDescription>
          )}
        </Field>
        <Button type="submit" className="sm:mt-6" disabled={lookup.isPending}>
          {lookup.isPending ? <Spinner /> : <Search />}
          Find recipient
        </Button>
      </form>

      {lookupError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{lookupError}</AlertDescription>
        </Alert>
      )}

      {found && (
        <div className="space-y-4" data-testid="recipient-card">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary text-primary-foreground" aria-hidden>
                {found.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-medium">
                {found.displayName} <UserCheck className="size-4 text-emerald-600" aria-label="Registered user" />
              </p>
              <p className="truncate text-sm text-muted-foreground">{found.email}</p>
            </div>
            <p className="text-right text-xs text-muted-foreground">
              Receives in
              <br />
              <span className="font-medium text-foreground">
                {found.preferredCurrency} · {CURRENCY_NAMES[found.preferredCurrency]}
              </span>
            </p>
          </div>
          <Button onClick={() => onContinue(found)}>Continue</Button>
        </div>
      )}
    </div>
  )
}
