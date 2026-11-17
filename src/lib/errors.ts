/**
 * Maps backend errors to user-facing messages. Never surfaces raw database text.
 */

type MaybeError = { code?: string; message?: string; status?: number } | null | undefined

const AUTH_MESSAGES: Record<string, string> = {
  user_already_exists: 'An account with this email already exists.',
  email_exists: 'An account with this email already exists.',
  invalid_credentials: 'Incorrect email or password.',
  weak_password: 'Password is too weak. Use at least 8 characters.',
  email_address_invalid: 'Enter a valid email address.',
  validation_failed: 'Please check the details you entered.',
  over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  over_email_send_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  signup_disabled: 'Registration is currently disabled.',
}

export function authErrorMessage(error: MaybeError): string {
  if (!error) return 'Something went wrong. Please try again.'
  if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code]
  if (error.status === 429) return AUTH_MESSAGES.over_request_rate_limit
  // The sign-up trigger rejects invalid profile data; Auth reports it generically.
  if (error.code === 'unexpected_failure' || /database error/i.test(error.message ?? '')) {
    return 'We could not create your account with those details. Please check them and try again.'
  }
  return 'Something went wrong. Please try again.'
}

export function genericErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    // PostgREST errors raised by our own functions start with a stable CODE.
    const code = /^([A-Z_]{3,})\b/.exec(error.message)?.[1]
    if (code) return code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
  }
  return 'Something went wrong. Please try again.'
}
