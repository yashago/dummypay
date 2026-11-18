// Playwright JSON reporter output → unified test model (see model.mjs).
import { firstLine, relPath, stripAnsi } from './model.mjs'

function statusOf(test, last) {
  switch (test.status) {
    case 'skipped':
      return 'skipped'
    case 'expected':
      return test.expectedStatus === 'skipped' ? 'skipped' : 'passed'
    case 'flaky':
      return 'flaky'
    case 'unexpected':
      return last?.status === 'interrupted' ? 'interrupted' : 'failed'
    default:
      return 'unknown'
  }
}

function errorOf(result) {
  if (!result) return undefined
  return result.error ?? result.errors?.[0]
}

export function parsePlaywright(raw, { root }) {
  const tests = []

  // Root suites are files (their title is the path); nested suites are describes.
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const results = t.results ?? []
        const last = results.at(-1)
        const status = statusOf(t, last)
        // For a flaky test, show the error from the attempt that failed.
        const errResult =
          status === 'flaky'
            ? results.findLast((r) => r.status !== 'passed' && r.status !== 'skipped')
            : status === 'passed' || status === 'skipped'
              ? undefined
              : last
        const err = errorOf(errResult)
        const message = stripAnsi(err?.message ?? '')
        const stack = stripAnsi(err?.stack ?? err?.message ?? '')
        tests.push({
          name: spec.title ?? '(unnamed test)',
          suite: titles.join(' › '),
          file: relPath(spec.file ?? suite.file ?? '', root),
          line: spec.line,
          project: t.projectName || undefined,
          status,
          durationMs: results.length
            ? results.reduce((sum, r) => sum + (r.duration ?? 0), 0)
            : undefined,
          retries: Math.max(0, results.length - 1),
          attempts: results.map((r) => ({
            retry: r.retry ?? 0,
            status: r.status ?? 'unknown',
            durationMs: r.duration,
          })),
          error: message ? firstLine(message) : undefined,
          stack: stack || undefined,
        })
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title].filter(Boolean))
  }
  for (const fileSuite of raw.suites ?? []) walk(fileSuite, [])

  return {
    tests,
    globalErrors: (raw.errors ?? []).map((e) => stripAnsi(e.message ?? e.stack ?? String(e))),
    startedAt: raw.stats?.startTime,
  }
}
