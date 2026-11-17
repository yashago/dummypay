import { supabase } from '@/lib/supabase'
import type { LoginInput, RegisterInput } from './schemas'

/**
 * Registration. display_name and preferred_currency travel as Auth metadata and
 * are validated again by the `handle_new_user` trigger, which also grants the
 * one-time initial balance server-side.
 */
export async function signUp(input: RegisterInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName, preferred_currency: input.preferredCurrency },
    },
  })
  if (error) throw error
  return data
}

export async function signIn(input: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword(input)
  if (error) throw error
  return data
}

/**
 * Sends a password-reset email. Supabase responds the same way whether or not
 * the address is registered, so this can't be used to discover accounts.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

/** Sets a new password for the user signed in by the recovery link. */
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
