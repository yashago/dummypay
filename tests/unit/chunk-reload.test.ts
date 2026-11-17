import { importWithReload, isChunkLoadError, reloadForNewDeployment } from '@/app/chunk-reload'

const chunkError = () =>
  new TypeError('Failed to fetch dynamically imported module: https://x/assets/NotificationsPage-rUd2r0uF.js')

beforeEach(() => sessionStorage.clear())

describe('isChunkLoadError', () => {
  it.each([
    ['Failed to fetch dynamically imported module: https://x/a.js', true], // Chrome
    ['error loading dynamically imported module: https://x/a.js', true], // Firefox
    ['Importing a module script failed.', true], // Safari
    ['Unable to preload CSS for /assets/x.css', true], // Vite
    ['Cannot read properties of undefined', false],
    ['NetworkError when attempting to fetch resource.', false],
  ])('%j → %s', (message, expected) => {
    expect(isChunkLoadError(new Error(message))).toBe(expected)
  })
})

describe('importWithReload', () => {
  it('returns the module when the import succeeds', async () => {
    const reload = vi.fn()
    await expect(importWithReload(async () => ({ ok: 1 }), reload)).resolves.toEqual({ ok: 1 })
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once on a stale chunk and keeps the page in its loading state', async () => {
    const reload = vi.fn()
    const pending = importWithReload(() => Promise.reject(chunkError()), reload)
    const settled = vi.fn()
    pending.then(settled, settled)
    await new Promise((r) => setTimeout(r, 20))
    expect(reload).toHaveBeenCalledOnce()
    expect(settled).not.toHaveBeenCalled()
  })

  it('does not loop: a second failure right after reloading surfaces the error', async () => {
    const reload = vi.fn()
    void importWithReload(() => Promise.reject(chunkError()), reload)
    await new Promise((r) => setTimeout(r, 0))
    await expect(importWithReload(() => Promise.reject(chunkError()), reload)).rejects.toThrow(
      /Failed to fetch dynamically imported module/,
    )
    expect(reload).toHaveBeenCalledOnce()
  })

  it('never swallows unrelated errors', async () => {
    const reload = vi.fn()
    await expect(importWithReload(() => Promise.reject(new Error('boom')), reload)).rejects.toThrow('boom')
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('reloadForNewDeployment', () => {
  it('allows another reload once the guard window has passed', () => {
    const reload = vi.fn()
    expect(reloadForNewDeployment(1_000_000, reload)).toBe(true)
    expect(reloadForNewDeployment(1_005_000, reload)).toBe(false)
    expect(reloadForNewDeployment(1_011_000, reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
