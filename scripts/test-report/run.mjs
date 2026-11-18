// Runs a test script with a JSON reporter added, then writes an HTML report to
// reports/ (even when tests fail or the run is interrupted).
// Exits with the test command's own exit code.
//
// Usage: node scripts/test-report/run.mjs <test:unit|test:int|test:e2e> [extra test args...]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countStatuses, makeRedactor, passRate } from './model.mjs'
import { parsePlaywright } from './parse-playwright.mjs'
import { parseVitest } from './parse-vitest.mjs'
import { extractReportData, renderReport } from './render.mjs'
import { reportPaths, saveReport } from './storage.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const p = reportPaths(root)

const TARGETS = {
  'test:unit': { framework: 'vitest', label: 'Vitest — unit tests' },
  'test:int': { framework: 'vitest', label: 'Vitest — integration tests' },
  'test:e2e': { framework: 'playwright', label: 'Playwright — end-to-end tests' },
}

const [script, ...extra] = process.argv.slice(2)
const target = TARGETS[script]
if (!target) {
  console.error(`Usage: node scripts/test-report/run.mjs <${Object.keys(TARGETS).join('|')}> [args...]`)
  process.exit(2)
}

mkdirSync(p.raw, { recursive: true })
const rawFile = path.join(p.raw, `${target.framework}-results.json`)
// Remove the previous raw file so stale results can never be reported as this run's.
rmSync(rawFile, { force: true })

const reporterArgs =
  target.framework === 'vitest'
    ? // `default` keeps the normal terminal output alongside the JSON file.
      ['--reporter=default', '--reporter=json', `--outputFile.json=${path.relative(root, rawFile).split(path.sep).join('/')}`]
    : // `list` is the reporter configured in playwright.config.ts.
      ['--reporter=list,json']
const env = { ...process.env }
if (target.framework === 'playwright') env.PLAYWRIGHT_JSON_OUTPUT_FILE = rawFile

const args = ['run', script, '--', ...reporterArgs, ...extra]
const displayCommand = `npm run ${script}${extra.length ? ` -- ${extra.join(' ')}` : ''}`
console.log(`[test-report] ${displayCommand} (+ ${target.framework} JSON reporter)\n`)

// Let Ctrl+C reach the test process while this wrapper stays alive to write the report.
let interruptedBySignal = false
process.on('SIGINT', () => {
  interruptedBySignal = true
})

const startedAt = new Date()
const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('error', (err) => finish(1, null, `Could not start the test command: ${err.message}`))
child.on('exit', (code, signal) => finish(code, signal))

let finished = false
function finish(code, signal, startError) {
  if (finished) return
  finished = true
  const durationMs = Date.now() - startedAt.getTime()
  const exitCode = code ?? 1
  const interrupted = Boolean(signal) || interruptedBySignal

  try {
    let parsed = { tests: [], globalErrors: [], startedAt: undefined }
    let incompleteReason = startError
    if (!startError) {
      if (!existsSync(rawFile)) {
        incompleteReason = `No ${target.framework} JSON results were written (exit code ${exitCode}${signal ? `, signal ${signal}` : ''}). The run probably crashed or was interrupted before the reporter finished.`
      } else {
        const raw = JSON.parse(readFileSync(rawFile, 'utf8'))
        parsed = target.framework === 'vitest' ? parseVitest(raw, { root }) : parsePlaywright(raw, { root })
      }
    }
    if (!incompleteReason && interrupted) incompleteReason = 'The run was interrupted; results cover only the tests that finished.'

    const counts = countStatuses(parsed.tests)
    const redact = makeRedactor()
    const model = redact({
      framework: target.framework,
      label: target.label,
      command: displayCommand,
      exitCode,
      interrupted,
      incomplete: Boolean(incompleteReason),
      incompleteReason,
      startedAt: parsed.startedAt ?? startedAt.toISOString(),
      durationMs,
      counts,
      passRate: passRate(counts),
      globalErrors: parsed.globalErrors,
      tests: parsed.tests,
    })

    const html = renderReport(model)
    // Verify: the embedded data must parse back and match what was rendered.
    const check = extractReportData(html)
    if (check.tests.length !== model.tests.length || check.counts.total !== counts.total) {
      throw new Error('rendered report does not round-trip its data')
    }
    const out = saveReport(root, model, html, startedAt)

    const pct = model.passRate === null ? 'n/a' : `${(model.passRate * 100).toFixed(1)}%`
    console.log(
      [
        '',
        `[test-report] ${target.label}: ${counts.total} total · ${counts.passed} passed · ${counts.failed} failed · ${counts.skipped} skipped` +
          (counts.flaky ? ` · ${counts.flaky} flaky` : '') +
          (counts.interrupted + counts.unknown ? ` · ${counts.interrupted + counts.unknown} other` : '') +
          ` · pass rate ${pct} · ${(durationMs / 1000).toFixed(1)} s · exit ${exitCode}`,
        model.incomplete ? `[test-report] WARNING: report may be incomplete — ${model.incompleteReason}` : null,
        `[test-report] Report:  ${path.relative(root, out.historyFile)}`,
        `[test-report] Latest:  ${path.relative(root, out.latest)}   Index: ${path.relative(root, out.index)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  } catch (err) {
    // A reporting failure never changes the test result.
    console.error(`\n[test-report] Report generation failed: ${err?.stack ?? err}`)
  }
  process.exit(exitCode)
}
