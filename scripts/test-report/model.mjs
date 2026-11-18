// Shared helpers for the unified test-report model.
//
// Report model:
//   { framework, label, command, exitCode, interrupted, incomplete, incompleteReason,
//     startedAt, durationMs, counts, passRate, globalErrors: string[],
//     tests: [{ name, suite, file, line?, project?, status, durationMs?,
//               retries?, attempts?, error?, stack? }] }
// status ∈ passed | failed | skipped | flaky | interrupted | unknown
import path from 'node:path'

export const STATUSES = ['passed', 'failed', 'skipped', 'flaky', 'interrupted', 'unknown']

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g
export const stripAnsi = (s) => (typeof s === 'string' ? s.replace(ANSI, '') : '')

export const firstLine = (s) =>
  (s ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean) ?? ''

export function relPath(file, root) {
  if (!file) return ''
  const rel = path.isAbsolute(file) ? path.relative(root, file) : file
  return rel.split(path.sep).join('/')
}

export function countStatuses(tests) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  for (const t of tests) counts[STATUSES.includes(t.status) ? t.status : 'unknown']++
  counts.total = tests.length
  return counts
}

/** Share of executed (non-skipped) tests that passed; flaky tests passed on retry. */
export function passRate(counts) {
  const executed = counts.total - counts.skipped
  return executed > 0 ? (counts.passed + counts.flaky) / executed : null
}

/**
 * Removes secrets from report text: the values of sensitive env vars, plus
 * Supabase secret keys and JWTs by pattern.
 */
export function makeRedactor(env = process.env) {
  const secrets = Object.entries(env)
    .filter(([k, v]) => /SECRET|TOKEN|PASSWORD|KEY/i.test(k) && v && v.length >= 8)
    .map(([, v]) => v)
    .sort((a, b) => b.length - a.length)
  const patterns = [/sb_secret_[A-Za-z0-9_-]+/g, /eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g]
  const redact = (s) => {
    let out = s
    for (const v of secrets) out = out.split(v).join('[redacted]')
    for (const p of patterns) out = out.replace(p, '[redacted]')
    return out
  }
  const walk = (x) =>
    typeof x === 'string'
      ? redact(x)
      : Array.isArray(x)
        ? x.map(walk)
        : x && typeof x === 'object'
          ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, walk(v)]))
          : x
  return walk
}
