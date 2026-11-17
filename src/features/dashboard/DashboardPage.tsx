import { AlertCircle, ArrowLeftRight, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RatesCard } from '@/features/fx/components/RatesCard'
import { RecentTransactionsCard } from '@/features/history/components/RecentTransactionsCard'
import { RecentNotificationsCard } from '@/features/notifications/components/RecentNotificationsCard'
import { useProfile } from '@/features/profile/api'
import { useWallets } from '@/features/wallets/api'
import { TotalBalanceCard } from '@/features/wallets/components/TotalBalanceCard'
import { WalletCard } from '@/features/wallets/components/WalletCard'

/** Recent transactions and notifications are added in phases 3–4. */
export function DashboardPage() {
  const profile = useProfile()
  const wallets = useWallets()
  const preferred = profile.data?.preferred_currency

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={profile.data ? `Welcome back, ${profile.data.display_name}.` : undefined}
        actions={
          <Button asChild>
            <Link to="/send">
              <ArrowLeftRight /> Send money
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TotalBalanceCard />

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Your balances</h2>
            {wallets.isPending ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : wallets.isError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>We couldn't load your wallets. Please refresh the page.</AlertDescription>
              </Alert>
            ) : wallets.data.length === 0 ? (
              <EmptyState icon={Wallet} title="No wallets yet" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {wallets.data.map((w) => (
                  <WalletCard
                    key={w.id}
                    currency={w.currency}
                    balanceMinor={w.balance_minor}
                    preferred={w.currency === preferred}
                  />
                ))}
              </div>
            )}
          </section>

          <RecentTransactionsCard />
        </div>

        <div className="space-y-6">
          {preferred && <RatesCard base={preferred} />}
          <RecentNotificationsCard />
        </div>
      </div>
    </>
  )
}
