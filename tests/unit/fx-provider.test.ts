import { parseExchangeRateApi } from '../../supabase/functions/_shared/fx.ts'

const NOW = Date.UTC(2026, 10, 17, 12, 0, 0)
const valid = {
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: NOW / 1000 - 3600,
  conversion_rates: { USD: 1, ILS: 3.6712, EUR: 0.9213, GBP: 0.7891, JPY: 154.2 },
}

describe('parseExchangeRateApi', () => {
  it('extracts only the supported currencies', () => {
    const parsed = parseExchangeRateApi(valid, NOW)
    expect(parsed).toEqual({
      ok: true,
      providerUpdatedAt: new Date(NOW - 3_600_000).toISOString(),
      rates: { ILS: 3.6712, USD: 1, EUR: 0.9213, GBP: 0.7891 },
    })
  })

  it.each([
    ['a non-object payload', null, 'payload is not an object'],
    ['a provider error', { result: 'error', 'error-type': 'invalid-key' }, 'provider error: invalid-key'],
    ['a different base', { ...valid, base_code: 'EUR' }, 'unexpected base currency'],
    ['a missing timestamp', { ...valid, time_last_update_unix: undefined }, 'missing provider timestamp'],
    ['a future timestamp', { ...valid, time_last_update_unix: NOW / 1000 + 3600 }, 'provider timestamp in the future'],
    ['missing rates', { ...valid, conversion_rates: undefined }, 'missing conversion_rates'],
    ['a missing currency', { ...valid, conversion_rates: { USD: 1, ILS: 3.6, EUR: 0.9 } }, 'invalid rate for GBP'],
    ['a zero rate', { ...valid, conversion_rates: { ...valid.conversion_rates, EUR: 0 } }, 'invalid rate for EUR'],
    ['a string rate', { ...valid, conversion_rates: { ...valid.conversion_rates, ILS: '3.6' } }, 'invalid rate for ILS'],
    ['an infinite rate', { ...valid, conversion_rates: { ...valid.conversion_rates, GBP: Infinity } }, 'invalid rate for GBP'],
    ['USD ≠ 1', { ...valid, conversion_rates: { ...valid.conversion_rates, USD: 1.01 } }, 'USD base rate must be 1'],
  ])('rejects %s', (_label, payload, error) => {
    expect(parseExchangeRateApi(payload, NOW)).toEqual({ ok: false, error })
  })
})
