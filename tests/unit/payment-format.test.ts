import { formatCardNumberInput, formatExpiry, formatExpiryInput } from '@/features/payment-methods/format'

describe('card input formatting', () => {
  it.each([
    ['4242424242424242', '4242 4242 4242 4242'],
    ['4242-4242 42', '4242 4242 42'],
    ['378282246310005', '3782 822463 10005'], // Amex 4-6-5
    ['42424242424242424242999', '4242 4242 4242 4242 424'], // capped at 19 digits
    ['abc', ''],
  ])('formats %j as %j', (raw, expected) => expect(formatCardNumberInput(raw)).toBe(expected))

  it('inserts the expiry slash', () => {
    expect(formatExpiryInput('1')).toBe('1')
    expect(formatExpiryInput('12')).toBe('12')
    expect(formatExpiryInput('1228')).toBe('12/28')
    expect(formatExpiryInput('12/289')).toBe('12/28')
  })

  it('displays stored expiry as MM/YY', () => {
    expect(formatExpiry(3, 2030)).toBe('03/30')
  })
})
