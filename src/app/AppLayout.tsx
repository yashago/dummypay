import { Menu } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { SimulatedBanner } from '@/components/shared/SimulatedBanner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav'
import { UserMenu } from './UserMenu'

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        D
      </div>
      <span className="text-lg font-semibold tracking-tight">DummyPay</span>
    </div>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <SimulatedBanner />
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-background p-4 lg:flex">
          <Brand />
          <NavList />
          <div className="mt-auto border-t pt-4">
            <UserMenu />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-4">
                <SheetHeader className="p-0 pb-4">
                  <SheetTitle asChild>
                    <div>
                      <Brand />
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <NavList onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <Brand />
            <div className="ml-auto">
              <UserMenu compact />
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
