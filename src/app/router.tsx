import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/routes'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { SettingsPage } from '@/features/profile/SettingsPage'
import { SendMoneyPage } from '@/features/transfers/SendMoneyPage'
import { WalletsPage } from '@/features/wallets/WalletsPage'
import { AppLayout } from './AppLayout'
import { PlaceholderPage } from './PlaceholderPage'

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'wallets', element: <WalletsPage /> },
          { path: 'send', element: <SendMoneyPage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'cards', element: <PlaceholderPage title="Payment Cards" phase={5} /> },
          { path: 'bank-accounts', element: <PlaceholderPage title="Bank Accounts" phase={5} /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
