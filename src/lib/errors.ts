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

/** Stable error codes raised by our Postgres functions (`raise exception 'CODE: ...'`). */
const RPC_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  INVALID_AMOUNT: 'Enter an amount between 0.01 and 1,000,000.00.',
  INVALID_CURRENCY: 'Choose a supported currency.',
  WALLET_EXISTS: 'You already have a wallet in this currency.',
  RATE_UNAVAILABLE: 'Exchange rates are currently unavailable. Please try again later.',
  RATE_STALE: 'Exchange rates are out of date. Please try again shortly.',
}

/** Extracts the leading CODE from a Postgres function error, if any. */
export function rpcErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return /^([A-Z][A-Z_]{2,})\b/.exec(error.message)?.[1] ?? null
  }
  return null
}

export function rpcErrorMessage(error: unknown, overrides: Record<string, string> = {}): string {
  const code = rpcErrorCode(error)
  if (code === 'INVALID_AMOUNT' && error && typeof error === 'object' && 'message' in error) {
    if (/too small/.test(String(error.message))) return 'Amount is too small to convert.'
  }
  if (code && (overrides[code] ?? RPC_MESSAGES[code])) return overrides[code] ?? RPC_MESSAGES[code]
  return 'Something went wrong. Please try again.'
}
