import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { PageHeader } from '@/components/shared/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { CURRENCY_NAMES } from '@/lib/money'
import { useProfile, useUpdateDisplayName } from './api'
import { PreferredCurrencyCard } from './components/PreferredCurrencyCard'

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters.')
    .max(50, 'Display name must be at most 50 characters.'),
})
type Values = z.infer<typeof schema>

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-sm sm:col-span-2 ${mono ? 'font-mono break-all' : ''}`}>{value}</dd>
    </div>
  )
}

export function SettingsPage() {
  const profile = useProfile()
  const update = useUpdateDisplayName()
  const form = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (profile.data) form.reset({ displayName: profile.data.display_name })
  }, [profile.data, form])

  const onSubmit = form.handleSubmit(async ({ displayName }) => {
    try {
      await update.mutateAsync(displayName)
      toast.success('Display name updated.')
    } catch {
      toast.error('Could not update your display name. Please try again.')
    }
  })

  if (profile.isPending) return <Skeleton className="h-64" />
  if (profile.isError)
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>We couldn't load your profile. Please refresh the page.</AlertDescription>
      </Alert>
    )

  const p = profile.data
  return (
    <>
      <PageHeader title="Profile & Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account details.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label="User ID" value={p.id} mono />
              <Row label="Email" value={p.email} />
              <Row label="Display name" value={p.display_name} />
              <Row
                label="Registered"
                value={new Date(p.created_at).toLocaleString(undefined, {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
              <Row
                label="Preferred currency"
                value={`${p.preferred_currency} — ${CURRENCY_NAMES[p.preferred_currency]}`}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit display name</CardTitle>
            <CardDescription>Shown to people who send you money.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate>
              <FieldGroup>
                <Field data-invalid={!!form.formState.errors.displayName}>
                  <FieldLabel htmlFor="displayName">Display name</FieldLabel>
                  <Input id="displayName" {...form.register('displayName')} />
                  <FieldError errors={[form.formState.errors.displayName]} />
                </Field>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || !form.formState.isDirty}
                  className="w-fit"
                >
                  {form.formState.isSubmitting && <Spinner />}
                  Save
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <PreferredCurrencyCard key={p.preferred_currency} current={p.preferred_currency} />
      </div>
    </>
  )
}
