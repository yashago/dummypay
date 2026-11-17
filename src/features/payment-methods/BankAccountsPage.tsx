import { BANK_COUNTRIES } from '@shared/payment-validation'
import { AlertCircle, Building2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { SimulatedBadge } from '@/components/shared/SimulatedBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBankAccounts, useDeleteBankAccount } from './api'
import { AddBankAccountDialog } from './components/AddBankAccountDialog'

export function BankAccountsPage() {
  const accounts = useBankAccounts()
  const remove = useDeleteBankAccount()

  return (
    <>
      <PageHeader
        title="Bank Accounts"
        description="Manage your simulated bank accounts."
        actions={<AddBankAccountDialog />}
      />

      <Alert className="mb-6">
        <Info />
        <AlertDescription>
          Bank accounts in DummyPay are simulated. They are not connected to any bank and no real transfers take place.
        </AlertDescription>
      </Alert>

      {accounts.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : accounts.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>We couldn't load your bank accounts. Please refresh the page.</AlertDescription>
        </Alert>
      ) : accounts.data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No bank accounts yet"
          description="Add a simulated bank account to see it here."
        />
      ) : (
        <ul className="space-y-3">
          {accounts.data.map((a) => (
            <li key={a.id} data-testid="bank-account-item">
              <Card>
                <CardContent className="flex flex-wrap items-center gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
                    <Building2 className="size-5 text-muted-foreground" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {a.bank_name} <SimulatedBadge />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.account_holder_name} · {BANK_COUNTRIES.find((c) => c.code === a.country)?.name ?? a.country} ·{' '}
                      {a.currency}
                    </p>
                    <p className="font-mono text-sm">
                      {a.identifier_type === 'iban' ? 'IBAN ' : 'Account '}
                      {a.masked_account_identifier}
                    </p>
                  </div>
                  <ConfirmDeleteButton
                    label={`Remove ${a.bank_name} account ${a.masked_account_identifier}`}
                    title={`Remove ${a.bank_name} account?`}
                    description="This simulated bank account will be removed from your account."
                    disabled={remove.isPending}
                    onConfirm={() =>
                      remove.mutate(a.id, {
                        onSuccess: () => toast.success('Bank account removed.'),
                        onError: () => toast.error('Could not remove the bank account. Please try again.'),
                      })
                    }
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
