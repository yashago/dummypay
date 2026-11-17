// Validation for simulated payment methods. Pure TypeScript (no Deno/Node
// APIs): enforced in the Edge Functions and mirrored in the browser for
// instant feedback (imported via the `@shared` alias). Unit-tested in
// tests/unit/payment-validation.test.ts.

export type FieldErrors<K extends string> = Partial<Record<K, string>>
export type Result<T, K extends string> = { ok: true; value: T } | { ok: false; errors: FieldErrors<K> }

const NAME_RE = /^[\p{L}][\p{L} .'’-]*$/u

function validateName(raw: unknown, label: string): { value?: string; error?: string } {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
  if (value.length < 2 || value.length > 100) return { error: `${label} must be 2–100 characters.` }
  if (!NAME_RE.test(value)) return { error: `${label} may only contain letters, spaces, and . ' -` }
  return { value }
}

// -----------------------------------------------------------------------------
// Cards
// -----------------------------------------------------------------------------
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'other'

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  other: 'Card',
}

const BRAND_LENGTHS: Record<CardBrand, number[]> = {
  visa: [13, 16, 19],
  mastercard: [16],
  amex: [15],
  discover: [16, 17, 18, 19],
  other: [12, 13, 14, 15, 16, 17, 18, 19],
}

/** Strips spaces and dashes; returns null if anything else non-numeric remains. */
export function normalizeCardNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/[\s-]/g, '')
  return /^\d+$/.test(digits) ? digits : null
}

export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

export function detectCardBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'visa'
  if (/^3[47]/.test(digits)) return 'amex'
  const first4 = Number(digits.slice(0, 4))
  if (/^5[1-5]/.test(digits) || (first4 >= 2221 && first4 <= 2720)) return 'mastercard'
  const first3 = Number(digits.slice(0, 3))
  if (/^6011/.test(digits) || /^65/.test(digits) || (first3 >= 644 && first3 <= 649)) return 'discover'
  return 'other'
}

export type CardInput = { cardholderName: unknown; cardNumber: unknown; expiry: unknown; cvv: unknown }
export type ValidCard = {
  cardholderName: string
  brand: CardBrand
  lastFour: string
  expMonth: number
  expYear: number
}

export function validateCard(input: CardInput, now = new Date()): Result<ValidCard, keyof CardInput> {
  const errors: FieldErrors<keyof CardInput> = {}

  const name = validateName(input.cardholderName, 'Cardholder name')
  if (name.error) errors.cardholderName = name.error

  const digits = normalizeCardNumber(input.cardNumber)
  let brand: CardBrand = 'other'
  if (!digits) {
    errors.cardNumber = 'Card number may only contain digits.'
  } else {
    brand = detectCardBrand(digits)
    if (!BRAND_LENGTHS[brand].includes(digits.length)) {
      errors.cardNumber = `Card number has an invalid length for ${CARD_BRAND_LABELS[brand]}.`
    } else if (!luhnValid(digits)) {
      errors.cardNumber = 'Card number is not valid (checksum failed).'
    }
  }

  let expMonth = 0
  let expYear = 0
  const expiry = typeof input.expiry === 'string' ? input.expiry.trim() : ''
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry)
  if (!m) {
    errors.expiry = 'Expiry must be in MM/YY format.'
  } else {
    expMonth = Number(m[1])
    expYear = 2000 + Number(m[2])
    const nowYear = now.getFullYear()
    const nowMonth = now.getMonth() + 1
    if (expYear < nowYear || (expYear === nowYear && expMonth < nowMonth)) {
      errors.expiry = 'This card has expired.'
    } else if (expYear > nowYear + 20) {
      errors.expiry = 'Expiry date is too far in the future.'
    }
  }

  const cvv = typeof input.cvv === 'string' ? input.cvv.trim() : ''
  const cvvLength = brand === 'amex' ? 4 : 3
  if (!new RegExp(`^\\d{${cvvLength}}$`).test(cvv)) {
    errors.cvv = `CVV must be ${cvvLength} digits.`
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    value: { cardholderName: name.value!, brand, lastFour: digits!.slice(-4), expMonth, expYear },
  }
}

// -----------------------------------------------------------------------------
// Bank accounts
// -----------------------------------------------------------------------------

/** Supported countries; `iban` is the IBAN length where the country uses IBAN. */
export const BANK_COUNTRIES: { code: string; name: string; iban?: number }[] = [
  { code: 'IL', name: 'Israel', iban: 23 },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom', iban: 22 },
  { code: 'DE', name: 'Germany', iban: 22 },
  { code: 'FR', name: 'France', iban: 27 },
  { code: 'ES', name: 'Spain', iban: 24 },
  { code: 'IT', name: 'Italy', iban: 27 },
  { code: 'NL', name: 'Netherlands', iban: 18 },
  { code: 'BE', name: 'Belgium', iban: 16 },
  { code: 'AT', name: 'Austria', iban: 20 },
  { code: 'CH', name: 'Switzerland', iban: 21 },
  { code: 'IE', name: 'Ireland', iban: 22 },
  { code: 'PT', name: 'Portugal', iban: 25 },
  { code: 'SE', name: 'Sweden', iban: 24 },
  { code: 'NO', name: 'Norway', iban: 15 },
  { code: 'DK', name: 'Denmark', iban: 18 },
  { code: 'FI', name: 'Finland', iban: 18 },
  { code: 'PL', name: 'Poland', iban: 28 },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
]

export const BANK_CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'] as const

export function ibanChecksumValid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const value = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export type BankInput = {
  accountHolderName: unknown
  bankName: unknown
  country: unknown
  currency: unknown
  accountIdentifier: unknown
}
export type ValidBankAccount = {
  accountHolderName: string
  bankName: string
  country: string
  currency: (typeof BANK_CURRENCIES)[number]
  identifierType: 'iban' | 'account_number'
  maskedIdentifier: string
}

export function validateBankAccount(input: BankInput): Result<ValidBankAccount, keyof BankInput> {
  const errors: FieldErrors<keyof BankInput> = {}

  const holder = validateName(input.accountHolderName, 'Account holder name')
  if (holder.error) errors.accountHolderName = holder.error

  const bankName = typeof input.bankName === 'string' ? input.bankName.trim().replace(/\s+/g, ' ') : ''
  if (bankName.length < 2 || bankName.length > 100) errors.bankName = 'Bank name must be 2–100 characters.'
  else if (/[<>{}]/.test(bankName)) errors.bankName = 'Bank name contains invalid characters.'

  const country = BANK_COUNTRIES.find((c) => c.code === input.country)
  if (!country) errors.country = 'Choose a supported country.'

  const currency = BANK_CURRENCIES.find((c) => c === input.currency)
  if (!currency) errors.currency = 'Choose a supported currency.'

  const raw = typeof input.accountIdentifier === 'string' ? input.accountIdentifier : ''
  const compact = raw.replace(/[\s-]/g, '').toUpperCase()
  let identifierType: 'iban' | 'account_number' = 'account_number'
  let masked = ''

  if (/^[A-Z]{2}/.test(compact)) {
    identifierType = 'iban'
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact)) {
      errors.accountIdentifier = 'IBAN format is not valid.'
    } else if (country && compact.slice(0, 2) !== country.code) {
      errors.accountIdentifier = `IBAN country code must match ${country.name} (${country.code}).`
    } else if (country && !country.iban) {
      errors.accountIdentifier = `${country.name} does not use IBANs — enter the account number.`
    } else if (country?.iban && compact.length !== country.iban) {
      errors.accountIdentifier = `A ${country.name} IBAN has ${country.iban} characters.`
    } else if (!ibanChecksumValid(compact)) {
      errors.accountIdentifier = 'IBAN is not valid (checksum failed).'
    } else {
      masked = `${compact.slice(0, 2)}•• •••• ${compact.slice(-4)}`
    }
  } else if (!/^\d{4,20}$/.test(compact)) {
    errors.accountIdentifier = 'Enter an IBAN or an account number of 4–20 digits.'
  } else {
    masked = `•••• ${compact.slice(-4)}`
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      accountHolderName: holder.value!,
      bankName,
      country: country!.code,
      currency: currency!,
      identifierType,
      maskedIdentifier: masked,
    },
  }
}
