import { AlertCircle, Wallet } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ConversionPreviewCard } from '@/features/fx/components/ConversionPreviewCard'
import { RatesCard } from '@/features/fx/components/RatesCard'
import { useProfile } from '@/features/profile/api'
import { useWallets } from './api'
import { AddWalletDialog } from './components/AddWalletDialog'
import { TotalBalanceCard } from './components/TotalBalanceCard'
import { WalletCard } from './components/WalletCard'

export function WalletsPage() {
  const profile = useProfile()
  const wallets = useWallets()
  const preferred = profile.data?.preferred_currency

  return (
    <>
      <PageHeader
        title="Wallets"
        description="Each currency wallet keeps its own independent balance."
        actions={wallets.data && <AddWalletDialog existing={wallets.data.map((w) => w.currency)} />}
      />

      <div className="mb-6">
        <TotalBalanceCard />
      </div>

      {wallets.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : wallets.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>We couldn't load your wallets. Please refresh the page.</AlertDescription>
        </Alert>
      ) : wallets.data.length === 0 ? (
        <EmptyState icon={Wallet} title="No wallets yet" description="Add a currency wallet to get started." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {preferred && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ConversionPreviewCard defaultFrom={preferred} />
          <RatesCard base={preferred} />
        </div>
      )}
    </>
  )
}
