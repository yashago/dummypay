import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/routes'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { BankAccountsPage } from '@/features/payment-methods/BankAccountsPage'
import { CardsPage } from '@/features/payment-methods/CardsPage'
import { SettingsPage } from '@/features/profile/SettingsPage'
import { SendMoneyPage } from '@/features/transfers/SendMoneyPage'
import { WalletsPage } from '@/features/wallets/WalletsPage'
import { AppLayout } from './AppLayout'


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
          { path: 'cards', element: <CardsPage /> },
          { path: 'bank-accounts', element: <BankAccountsPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
