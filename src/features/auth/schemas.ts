import { z } from 'zod'
import { CURRENCY_CODES } from '@/lib/money'

// bcrypt (used by Supabase Auth) only considers the first 72 bytes.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')

const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'))

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters.')
      .max(50, 'Display name must be at most 50 characters.'),
    email: emailField,
    password,
    confirmPassword: z.string(),
    preferredCurrency: z.enum(CURRENCY_CODES, 'Choose a preferred currency.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })
export type RegisterInput = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email: emailField })
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
