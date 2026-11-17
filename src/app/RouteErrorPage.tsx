import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useRouteError } from 'react-router'
import { SimulatedBanner } from '@/components/shared/SimulatedBanner'
import { Button } from '@/components/ui/button'
import { isChunkLoadError } from './chunk-reload'

/** Friendly replacement for React Router's default "Unexpected Application Error!". */
export function RouteErrorPage() {
  const error = useRouteError()
  const updated = isChunkLoadError(error)

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <SimulatedBanner />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="max-w-md text-center" role="alert" data-testid="route-error">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-amber-100 text-amber-800">
            <AlertTriangle className="size-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">
            {updated ? 'DummyPay has been updated' : 'Something went wrong'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {updated
              ? 'A newer version is available. Reload the page to continue.'
              : 'An unexpected error occurred. Your balances and transfers are safe — please reload and try again.'}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw /> Reload
            </Button>
            <Button variant="outline" onClick={() => window.location.assign('/')}>
              Go to dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
