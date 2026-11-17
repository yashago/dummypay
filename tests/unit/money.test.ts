import { formatMoney, isCurrencyCode, parseAmountToMinor } from '@/lib/money'

describe('formatMoney', () => {
  it.each([
    [1_300_000, 'ILS', '₪13,000.00'],
    [500_000, 'USD', '$5,000.00'],
    [500_000, 'EUR', '€5,000.00'],
    [500_000, 'GBP', '£5,000.00'],
    [1, 'USD', '$0.01'],
    [0, 'USD', '$0.00'],
    [-2550, 'USD', '-$25.50'],
  ] as const)('formats %i %s as %s', (minor, currency, expected) => {
    expect(formatMoney(minor, currency)).toBe(expected)
  })

  it('formats large values exactly (no float drift)', () => {
    expect(formatMoney(900_719_925_474_099, 'USD')).toBe('$9,007,199,254,740.99')
  })

  it('rejects non-integer minor units', () => {
    expect(() => formatMoney(10.5, 'USD')).toThrow(RangeError)
  })
})

describe('parseAmountToMinor', () => {
  it.each([
    ['100', 10_000],
    ['100.5', 10_050],
    ['100.05', 10_005],
    ['0.01', 1],
    ['1,234.56', 123_456],
    ['  7  ', 700],
    ['007.10', 710],
  ])('parses %j → %i', (input, expected) => {
    expect(parseAmountToMinor(input, 'USD')).toEqual({ ok: true, minor: expected })
  })

  it.each([
    ['', 'Enter an amount.'],
    ['abc', 'Enter a valid positive number.'],
    ['-5', 'Enter a valid positive number.'],
    ['1e3', 'Enter a valid positive number.'],
    ['0', 'Amount must be greater than zero.'],
    ['0.00', 'Amount must be greater than zero.'],
    ['1.234', 'Use at most 2 decimal places.'],
    ['99999999999999999', 'Amount is too large.'],
  ])('rejects %j', (input, error) => {
    expect(parseAmountToMinor(input, 'USD')).toEqual({ ok: false, error })
  })

  it('never uses float arithmetic (0.1 + 0.2 case)', () => {
    expect(parseAmountToMinor('0.30', 'EUR')).toEqual({ ok: true, minor: 30 })
  })
})

describe('isCurrencyCode', () => {
  it('accepts only supported currencies', () => {
    expect(isCurrencyCode('ILS')).toBe(true)
    expect(isCurrencyCode('JPY')).toBe(false)
    expect(isCurrencyCode(undefined)).toBe(false)
  })
})
