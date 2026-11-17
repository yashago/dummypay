import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/routes'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { SettingsPage } from '@/features/profile/SettingsPage'
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
          { path: 'wallets', element: <PlaceholderPage title="Wallets" phase={2} /> },
          { path: 'send', element: <PlaceholderPage title="Send Money" phase={3} /> },
          { path: 'history', element: <PlaceholderPage title="Transaction History" phase={3} /> },
          { path: 'cards', element: <PlaceholderPage title="Payment Cards" phase={5} /> },
          { path: 'bank-accounts', element: <PlaceholderPage title="Bank Accounts" phase={5} /> },
          { path: 'notifications', element: <PlaceholderPage title="Notifications" phase={4} /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
