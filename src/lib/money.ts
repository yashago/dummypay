import type { Database } from '@/types/database'

/**
 * Money helpers. All amounts are integer *minor units* (agorot, cents, pence).
 * The client only formats and parses; financial calculations happen in Postgres.
 */

export type CurrencyCode = Database['public']['Enums']['currency_code']

export const CURRENCY_CODES = ['ILS', 'USD', 'EUR', 'GBP'] as const satisfies readonly CurrencyCode[]

/** Decimal places per currency; mirrors public.supported_currencies.minor_units. */
export const MINOR_UNITS: Record<CurrencyCode, number> = { ILS: 2, USD: 2, EUR: 2, GBP: 2 }

export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  ILS: 'Israeli Shekel',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (CURRENCY_CODES as readonly string[]).includes(value)
}

/** Format minor units for display, e.g. formatMoney(1300000, 'ILS') → "₪13,000.00". */
export function formatMoney(minor: number, currency: CurrencyCode, locale = 'en-US'): string {
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Amount must be an integer number of minor units, got ${minor}`)
  }
  const digits = MINOR_UNITS[currency]
  // Build the decimal string exactly instead of dividing floats.
  const negative = minor < 0
  const abs = Math.abs(minor).toString().padStart(digits + 1, '0')
  const whole = abs.slice(0, abs.length - digits)
  const fraction = digits > 0 ? abs.slice(-digits) : ''
  const decimal = `${negative ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    // Intl accepts decimal strings, which avoids any float rounding.
  }).format(decimal as unknown as number)
}

/** Display an exchange rate (server-computed) with up to 6 significant decimals. */
export function formatRate(rate: number): string {
  return rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export type ParseResult = { ok: true; minor: number } | { ok: false; error: string }

/**
 * Parse a user-typed amount ("1,234.5", "100") into minor units without floats.
 * Rejects negatives, zero, non-numeric input and more decimals than the currency allows.
 */
export function parseAmountToMinor(input: string, currency: CurrencyCode): ParseResult {
  const digits = MINOR_UNITS[currency]
  const cleaned = input.trim().replace(/,/g, '')

  if (cleaned === '') return { ok: false, error: 'Enter an amount.' }
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { ok: false, error: 'Enter a valid positive number.' }

  const [whole, fraction = ''] = cleaned.split('.')
  if (fraction.length > digits) {
    return { ok: false, error: `Use at most ${digits} decimal places.` }
  }

  const minorString = (whole + fraction.padEnd(digits, '0')).replace(/^0+(?=\d)/, '')
  const minor = Number(minorString)
  if (!Number.isSafeInteger(minor)) return { ok: false, error: 'Amount is too large.' }
  if (minor <= 0) return { ok: false, error: 'Amount must be greater than zero.' }

  return { ok: true, minor }
}
