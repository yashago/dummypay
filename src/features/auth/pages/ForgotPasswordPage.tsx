import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authErrorMessage } from '@/lib/errors'
import { requestPasswordReset } from '../api'
import { AuthLayout } from '../components/AuthLayout'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas'

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      await requestPasswordReset(email)
      setSentTo(email)
    } catch (err) {
      setFormError(authErrorMessage(err as never))
    }
  })

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your account email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <Alert data-testid="reset-sent">
          <MailCheck />
          <AlertDescription>
            If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset the password. It may take a
            few minutes to arrive — check your spam folder too.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {formError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
              <FieldError errors={[errors.email]} />
            </Field>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Spinner />}
              Send reset link
            </Button>
          </FieldGroup>
        </form>
      )}
    </AuthLayout>
  )
}
