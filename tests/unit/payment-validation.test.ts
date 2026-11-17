import {
  detectCardBrand,
  ibanChecksumValid,
  luhnValid,
  validateBankAccount,
  validateCard,
} from '@shared/payment-validation'

const NOW = new Date(2026, 10, 17) // 17 Nov 2026
const goodCard = {
  cardholderName: 'Dana Levi',
  cardNumber: '4242 4242 4242 4242',
  expiry: '12/28',
  cvv: '123',
}

describe('luhn & brand detection', () => {
  it.each([
    ['4242424242424242', true],
    ['4242424242424241', false],
    ['378282246310005', true], // Amex test number
    ['5555555555554444', true], // Mastercard
    ['2223003122003222', true], // Mastercard 2-series
    ['6011111111111117', true], // Discover
    ['0000000000000000', true],
    ['1234567812345678', false],
  ])('luhn(%s) = %s', (n, ok) => expect(luhnValid(n)).toBe(ok))

  it.each([
    ['4242424242424242', 'visa'],
    ['378282246310005', 'amex'],
    ['5555555555554444', 'mastercard'],
    ['2223003122003222', 'mastercard'],
    ['6011111111111117', 'discover'],
    ['6445644564456445', 'discover'],
    ['9999999999999995', 'other'],
  ])('brand(%s) = %s', (n, brand) => expect(detectCardBrand(n)).toBe(brand))
})

describe('validateCard', () => {
  it('accepts a valid card and keeps only what may be stored', () => {
    const r = validateCard(goodCard, NOW)
    expect(r).toEqual({
      ok: true,
      value: { cardholderName: 'Dana Levi', brand: 'visa', lastFour: '4242', expMonth: 12, expYear: 2028 },
    })
    expect(JSON.stringify(r)).not.toContain('4242424242424242')
    expect(JSON.stringify(r)).not.toContain('123')
  })

  it('accepts a card expiring this month', () => {
    expect(validateCard({ ...goodCard, expiry: '11/26' }, NOW).ok).toBe(true)
  })

  it('requires a 4-digit CVV for Amex', () => {
    const amex = { ...goodCard, cardNumber: '3782 822463 10005' }
    expect(validateCard({ ...amex, cvv: '1234' }, NOW).ok).toBe(true)
    expect(validateCard({ ...amex, cvv: '123' }, NOW)).toMatchObject({ errors: { cvv: 'CVV must be 4 digits.' } })
  })

  it.each([
    [{ cardNumber: '4242 4242 4242 4241' }, 'cardNumber', /checksum/],
    [{ cardNumber: '4242-abcd-4242-4242' }, 'cardNumber', /only contain digits/],
    [{ cardNumber: '4242 4242 4242' }, 'cardNumber', /invalid length/],
    [{ expiry: '10/26' }, 'expiry', /expired/],
    [{ expiry: '13/27' }, 'expiry', /MM\/YY/],
    [{ expiry: '1/27' }, 'expiry', /MM\/YY/],
    [{ expiry: '12/2028' }, 'expiry', /MM\/YY/],
    [{ expiry: '12/60' }, 'expiry', /too far/],
    [{ cvv: '12' }, 'cvv', /3 digits/],
    [{ cvv: '12a' }, 'cvv', /3 digits/],
    [{ cardholderName: 'D' }, 'cardholderName', /2–100/],
    [{ cardholderName: '<script>' }, 'cardholderName', /letters/],
    [{ cardNumber: 4242424242424242 }, 'cardNumber', /only contain digits/],
  ])('rejects %j', (override, field, message) => {
    const r = validateCard({ ...goodCard, ...override }, NOW)
    expect(r.ok).toBe(false)
    expect((r as { errors: Record<string, string> }).errors[field]).toMatch(message)
  })
})

describe('validateBankAccount', () => {
  const base = {
    accountHolderName: 'Dana Levi',
    bankName: 'Bank Hapoalim',
    country: 'IL',
    currency: 'ILS',
    accountIdentifier: 'IL62 0108 0000 0009 9999 999',
  }

  it.each(['IL620108000000099999999', 'GB82WEST12345698765432', 'DE89370400440532013000'])(
    'IBAN checksum ok: %s',
    (iban) => expect(ibanChecksumValid(iban)).toBe(true),
  )

  it('accepts a valid IBAN and stores it masked', () => {
    const r = validateBankAccount(base)
    expect(r).toEqual({
      ok: true,
      value: {
        accountHolderName: 'Dana Levi',
        bankName: 'Bank Hapoalim',
        country: 'IL',
        currency: 'ILS',
        identifierType: 'iban',
        maskedIdentifier: 'IL•• •••• 9999',
      },
    })
  })

  it('accepts a plain account number and masks it', () => {
    const r = validateBankAccount({ ...base, country: 'US', currency: 'USD', accountIdentifier: '000123456789' })
    expect(r).toMatchObject({ ok: true, value: { identifierType: 'account_number', maskedIdentifier: '•••• 6789' } })
  })

  it.each([
    [{ accountIdentifier: 'IL62 0108 0000 0009 9999 998' }, /checksum/],
    [{ accountIdentifier: 'GB82WEST12345698765432' }, /must match Israel/],
    [{ accountIdentifier: 'IL62 0108 0000 0009 9999' }, /23 characters/],
    [{ country: 'US', accountIdentifier: 'US12345678' }, /does not use IBANs/],
    [{ accountIdentifier: '12' }, /4–20 digits/],
    [{ accountIdentifier: '12345678901234567890123' }, /4–20 digits/],
  ])('rejects identifier %j', (override, message) => {
    const r = validateBankAccount({ ...base, ...override })
    expect((r as { errors: Record<string, string> }).errors.accountIdentifier).toMatch(message)
  })

  it('validates holder, bank, country and currency', () => {
    const r = validateBankAccount({ accountHolderName: '', bankName: 'x', country: 'ZZ', currency: 'JPY', accountIdentifier: '1234' })
    expect(r).toMatchObject({
      ok: false,
      errors: {
        accountHolderName: expect.any(String),
        bankName: expect.any(String),
        country: expect.any(String),
        currency: expect.any(String),
      },
    })
  })
})
