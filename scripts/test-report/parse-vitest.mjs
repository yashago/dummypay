// Vitest JSON reporter output → unified test model (see model.mjs).
import { firstLine, relPath, stripAnsi } from './model.mjs'

const STATUS = {
  passed: 'passed',
  failed: 'failed',
  skipped: 'skipped',
  pending: 'skipped',
  todo: 'skipped',
  disabled: 'skipped',
}

export function parseVitest(raw, { root }) {
  const tests = []

  for (const file of raw.testResults ?? []) {
    const filePath = relPath(file.name, root)
    const assertions = file.assertionResults ?? []
    const fileMessage = stripAnsi(file.message ?? '')

    for (const a of assertions) {
      const failure = stripAnsi((a.failureMessages ?? []).join('\n\n'))
      tests.push({
        name: a.title ?? a.fullName ?? '(unnamed test)',
        suite: (a.ancestorTitles ?? []).filter(Boolean).join(' › '),
        file: filePath,
        line: a.location?.line,
        status: STATUS[a.status] ?? 'unknown',
        durationMs: typeof a.duration === 'number' ? a.duration : undefined,
        error: failure ? firstLine(failure) : undefined,
        stack: failure || undefined,
      })
    }

    // A file can fail without any failing test: it failed to load, or a
    // beforeAll/afterAll hook threw. Report it as its own failed entry so the
    // failure is never hidden behind otherwise-green tests.
    const anyTestFailed = assertions.some((a) => a.status === 'failed')
    if (file.status === 'failed' && !anyTestFailed) {
      tests.push({
        name: assertions.length ? '(file-level error: hook or teardown)' : '(file failed to run)',
        suite: '',
        file: filePath,
        status: 'failed',
        durationMs:
          file.endTime && file.startTime ? Math.max(0, file.endTime - file.startTime) : undefined,
        error: firstLine(fileMessage) || 'The file failed without a test-level error.',
        stack: fileMessage || undefined,
      })
    }
  }

  return {
    tests,
    globalErrors: [],
    startedAt: raw.startTime ? new Date(raw.startTime).toISOString() : undefined,
  }
}
