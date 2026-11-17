import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState = { session: Session | null; loading: boolean }

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** The signed-in user's id, for cache keys and UI. Only valid inside a ProtectedRoute. */
export function useUserId(): string {
  const { session } = useAuth()
  if (!session) throw new Error('useUserId called without a session')
  return session.user.id
}
