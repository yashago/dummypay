import { Navigate, Outlet, useLocation } from 'react-router'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from './context'

function FullPageSpinner() {
  return (
    <div className="grid min-h-svh place-items-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}

/** Requires an authenticated session before any wallet or financial page renders. */
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Login/register pages redirect away once signed in. */
export function PublicOnlyRoute() {
  const { session, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
