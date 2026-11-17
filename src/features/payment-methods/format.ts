import { detectCardBrand } from '@shared/payment-validation'

/** Groups digits as the user types: Amex 4-6-5, others in blocks of 4. Max 19 digits. */
export function formatCardNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19)
  if (detectCardBrand(digits) === 'amex') {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ')
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** Inserts the slash for MM/YY as the user types. */
export function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

export function formatExpiry(month: number, year: number): string {
  return `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`
}
