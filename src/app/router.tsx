import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/routes'
import { AppLayout } from './AppLayout'
import { importWithReload } from './chunk-reload'
import { PageFallback } from './PageFallback'
import { RouteErrorPage } from './RouteErrorPage'

// Each page is its own chunk, loaded on first visit. If a chunk is gone because
// a newer deployment replaced it, importWithReload reloads the page once.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(async () => ({ default: (await importWithReload(load))[name] }))

const LoginPage = page(() => import('@/features/auth/pages/LoginPage'), 'LoginPage')
const RegisterPage = page(() => import('@/features/auth/pages/RegisterPage'), 'RegisterPage')
const ForgotPasswordPage = page(
  () => import('@/features/auth/pages/ForgotPasswordPage'),
  'ForgotPasswordPage',
)
const ResetPasswordPage = page(
  () => import('@/features/auth/pages/ResetPasswordPage'),
  'ResetPasswordPage',
)
const DashboardPage = page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage')
const WalletsPage = page(() => import('@/features/wallets/WalletsPage'), 'WalletsPage')
const SendMoneyPage = page(() => import('@/features/transfers/SendMoneyPage'), 'SendMoneyPage')
const HistoryPage = page(() => import('@/features/history/HistoryPage'), 'HistoryPage')
const CardsPage = page(() => import('@/features/payment-methods/CardsPage'), 'CardsPage')
const BankAccountsPage = page(
  () => import('@/features/payment-methods/BankAccountsPage'),
  'BankAccountsPage',
)
const NotificationsPage = page(
  () => import('@/features/notifications/NotificationsPage'),
  'NotificationsPage',
)
const SettingsPage = page(() => import('@/features/profile/SettingsPage'), 'SettingsPage')

function load(Page: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Page />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    // Any error below (incl. a chunk that still fails after the reload) shows
    // a friendly page instead of React Router's default error screen.
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: 'login', element: load(LoginPage) },
          { path: 'register', element: load(RegisterPage) },
          { path: 'forgot-password', element: load(ForgotPasswordPage) },
        ],
      },
      // Reached from the emailed link, which signs the user in for recovery — so it
      // sits outside both the public-only and the protected guards.
      { path: 'reset-password', element: load(ResetPasswordPage) },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: load(DashboardPage) },
              { path: 'wallets', element: load(WalletsPage) },
              { path: 'send', element: load(SendMoneyPage) },
              { path: 'history', element: load(HistoryPage) },
              { path: 'cards', element: load(CardsPage) },
              { path: 'bank-accounts', element: load(BankAccountsPage) },
              { path: 'notifications', element: load(NotificationsPage) },
              { path: 'settings', element: load(SettingsPage) },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
