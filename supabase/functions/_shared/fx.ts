// Pure helpers for the fx-refresh function. No Deno/Node APIs, so the same
// file is unit-tested with Vitest (tests/unit/fx-provider.test.ts).

export const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const PROVIDER = 'exchangerate-api.com'

export type ParsedRates =
  | { ok: true; providerUpdatedAt: string; rates: Record<SupportedCurrency, number> }
  | { ok: false; error: string }

/**
 * Validates an ExchangeRate-API v6 `/latest/USD` response and extracts the
 * supported currencies. Anything unexpected is rejected — we never store a
 * partial or nonsensical snapshot.
 */
export function parseExchangeRateApi(payload: unknown, now = Date.now()): ParsedRates {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'payload is not an object' }
  const p = payload as Record<string, unknown>

  if (p.result !== 'success') {
    const type = typeof p['error-type'] === 'string' ? p['error-type'] : 'unknown'
    return { ok: false, error: `provider error: ${type}` }
  }
  if (p.base_code !== 'USD') return { ok: false, error: 'unexpected base currency' }

  const updatedUnix = p.time_last_update_unix
  if (typeof updatedUnix !== 'number' || !Number.isFinite(updatedUnix) || updatedUnix <= 0) {
    return { ok: false, error: 'missing provider timestamp' }
  }
  const updatedMs = updatedUnix * 1000
  if (updatedMs > now + 10 * 60 * 1000) return { ok: false, error: 'provider timestamp in the future' }

  const source = p.conversion_rates
  if (!source || typeof source !== 'object') return { ok: false, error: 'missing conversion_rates' }

  const rates = {} as Record<SupportedCurrency, number>
  for (const code of SUPPORTED_CURRENCIES) {
    const value = (source as Record<string, unknown>)[code]
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 1e9) {
      return { ok: false, error: `invalid rate for ${code}` }
    }
    rates[code] = value
  }
  if (rates.USD !== 1) return { ok: false, error: 'USD base rate must be 1' }

  return { ok: true, providerUpdatedAt: new Date(updatedMs).toISOString(), rates }
}
