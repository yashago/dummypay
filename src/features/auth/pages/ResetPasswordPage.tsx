import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authErrorMessage } from '@/lib/errors'
import { updatePassword } from '../api'
import { AuthLayout } from '../components/AuthLayout'
import { useAuth } from '../context'
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas'

/**
 * Landing page for the emailed reset link. Supabase signs the user in from the
 * link (recovery session); without that session the link is invalid/expired.
 */
export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null)
    try {
      await updatePassword(password)
      toast.success('Your password has been updated.')
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(authErrorMessage(err as never))
    }
  })

  const footer = (
    <Link to="/login" className="font-medium text-primary hover:underline">
      Back to sign in
    </Link>
  )

  if (loading) {
    return (
      <AuthLayout title="Choose a new password" description="Checking your reset link…" footer={footer}>
        <Spinner className="mx-auto size-6" />
      </AuthLayout>
    )
  }

  if (!session) {
    return (
      <AuthLayout title="Reset link invalid" description="This link is invalid or has expired." footer={footer}>
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Reset links can only be used once and expire after a while.{' '}
            <Link to="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
            .
          </AlertDescription>
        </Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description={`Resetting the password for ${session.user.email}.`}
      footer={footer}
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {formError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
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
            <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
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
            Update password
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  )
}
