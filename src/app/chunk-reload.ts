/**
 * Recovery from stale code chunks after a deployment.
 *
 * Each page is a separate, content-hashed file. A tab opened before a deploy
 * still runs the old build and asks for chunk names that the new deployment no
 * longer serves (404). When that happens we reload once so the browser picks up
 * the new build. A short guard window prevents reload loops if the failure has
 * another cause (e.g. the network is down) — then the error is shown instead.
 */

const RELOAD_KEY = 'dummypay:chunk-reload-at'
const GUARD_MS = 10_000

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite preload helper
]

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(message))
}

function readLastReload(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  } catch {
    return 0
  }
}

/** Reloads once per guard window. Returns false if we already just reloaded. */
export function reloadForNewDeployment(now = Date.now(), reload = () => window.location.reload()): boolean {
  if (now - readLastReload() < GUARD_MS) return false
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now))
  } catch {
    // Storage unavailable: still reload; the guard just can't persist.
  }
  reload()
  return true
}

/** Wraps a dynamic import so a stale-chunk failure triggers a one-time reload. */
export async function importWithReload<T>(load: () => Promise<T>, reload?: () => void): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isChunkLoadError(error) && reloadForNewDeployment(Date.now(), reload)) {
      // The page is reloading; never settle so React keeps the fallback up.
      return new Promise<T>(() => {})
    }
    throw error
  }
}
