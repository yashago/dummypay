import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Gift } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useSupportedCurrencies } from '@/features/currencies/api'
import { authErrorMessage } from '@/lib/errors'
import { CURRENCY_CODES, CURRENCY_NAMES, formatMoney } from '@/lib/money'
import { signUp } from '../api'
import { AuthLayout } from '../components/AuthLayout'
import { registerSchema, type RegisterInput } from '../schemas'

export function RegisterPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const currencies = useSupportedCurrencies()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const selected = useWatch({ control, name: 'preferredCurrency' })
  const grant = currencies.data?.find((c) => c.code === selected)?.initial_grant_minor

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const { session } = await signUp(values)
      navigate(session ? '/' : '/login', { replace: true })
    } catch (err) {
      setFormError(authErrorMessage(err as never))
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      description="Register to receive fictional funds and send them to other users."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {formError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!errors.displayName}>
            <FieldLabel htmlFor="displayName">Display name</FieldLabel>
            <Input
              id="displayName"
              autoComplete="name"
              aria-invalid={!!errors.displayName}
              {...register('displayName')}
            />
            <FieldError errors={[errors.displayName]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.preferredCurrency}>
            <FieldLabel htmlFor="preferredCurrency">Preferred currency</FieldLabel>
            <Controller
              control={control}
              name="preferredCurrency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="preferredCurrency"
                    className="w-full"
                    aria-invalid={!!errors.preferredCurrency}
                  >
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code} — {CURRENCY_NAMES[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {selected && grant !== undefined ? (
              <FieldDescription className="flex items-center gap-1.5">
                <Gift className="size-3.5" aria-hidden />
                You'll receive a one-time welcome credit of {formatMoney(grant, selected)} (fictional).
              </FieldDescription>
            ) : (
              <FieldDescription>Your first wallet and incoming transfers use this currency.</FieldDescription>
            )}
            <FieldError errors={[errors.preferredCurrency]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            <FieldDescription>At least 8 characters.</FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Spinner />}
            Create account
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  )
}
