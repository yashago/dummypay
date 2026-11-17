import {
  ArrowLeftRight,
  Bell,
  Building2,
  CreditCard,
  History,
  LayoutDashboard,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon }

/** The eight main sections from PRODUCT_REQUIREMENTS §10. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/wallets', label: 'Wallets', icon: Wallet },
  { to: '/send', label: 'Send Money', icon: ArrowLeftRight },
  { to: '/history', label: 'Transaction History', icon: History },
  { to: '/cards', label: 'Payment Cards', icon: CreditCard },
  { to: '/bank-accounts', label: 'Bank Accounts', icon: Building2 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Profile & Settings', icon: Settings },
]
