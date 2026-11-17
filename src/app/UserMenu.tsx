import { LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/features/auth/api'
import { useProfile } from '@/features/profile/api'

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const { data: profile } = useProfile()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Could not sign out. Please try again.')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={compact ? 'size-9 rounded-full p-0' : 'h-auto w-full justify-start gap-3 px-2 py-2'}
          // Icon-only (compact) needs a label; otherwise the visible text is the name,
          // prefixed so it still reads "Account menu …" (WCAG 2.5.3 label-in-name).
          aria-label={compact ? 'Account menu' : undefined}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground" aria-hidden>
              {profile ? initials(profile.display_name) : '…'}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <span className="flex min-w-0 flex-col items-start text-left">
              <span className="sr-only">Account menu: </span>
              <span className="truncate text-sm font-medium">{profile?.display_name}</span>
              <span className="truncate text-xs text-muted-foreground">{profile?.email}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{profile?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings /> Profile & Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
