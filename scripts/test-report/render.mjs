// Fills the HTML templates. Report data is embedded as JSON and rendered in the
// browser with textContent, so test names and error messages can't inject HTML.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates')
const read = (name) => readFileSync(path.join(TEMPLATES, name), 'utf8')
// Function replacers so `$` sequences in the content are never interpreted.
const fill = (template, marker, value) => template.replace(marker, () => value)

const LINE_SEP = String.fromCharCode(0x2028)
const PARA_SEP = String.fromCharCode(0x2029)

/** JSON that is safe inside <script type="application/json">. */
const toScriptJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replaceAll(LINE_SEP, '\\u2028')
    .replaceAll(PARA_SEP, '\\u2029')

export const escapeHtml = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  )

export function renderReport(model) {
  let html = read('report.html')
  html = fill(html, '/*__STYLES__*/', read('styles.css'))
  html = fill(html, '/*__REPORT_DATA__*/', toScriptJson(model))
  return html
}

/** Reads the embedded data back out of a rendered report (used to verify it). */
export function extractReportData(html) {
  const m = html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)
  if (!m) throw new Error('report data block not found')
  return JSON.parse(m[1])
}

const fmtDur = (ms) =>
  typeof ms !== 'number' ? '—' : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`

export function renderIndex(entries) {
  const sorted = [...entries].sort((a, b) => b.file.localeCompare(a.file))
  const rows = sorted
    .map((e) => {
      const status = e.incomplete ? 'interrupted' : e.exitCode === 0 ? 'passed' : 'failed'
      const label = e.incomplete ? 'Incomplete' : e.exitCode === 0 ? 'Passed' : 'Failed'
      const when = e.startedAt ? new Date(e.startedAt).toLocaleString() : '—'
      const c = e.counts ?? {}
      return `<tr>
        <td><span class="pill ${status}">${label}</span></td>
        <td>${escapeHtml(when)}</td>
        <td>${escapeHtml(e.label)}</td>
        <td class="num">${c.total ?? '—'}</td>
        <td class="num">${c.passed ?? '—'}</td>
        <td class="num">${c.failed ?? '—'}</td>
        <td class="num">${c.skipped ?? '—'}</td>
        <td class="num">${c.flaky ?? '—'}</td>
        <td class="num">${escapeHtml(fmtDur(e.durationMs))}</td>
        <td><a href="history/${encodeURIComponent(e.file)}">Open</a></td>
      </tr>`
    })
    .join('\n')
  const summary = `${entries.length} report${entries.length === 1 ? '' : 's'} · newest first`
  let html = read('index.html')
  html = fill(html, '/*__STYLES__*/', read('styles.css'))
  html = fill(html, '/*__SUMMARY__*/', escapeHtml(summary))
  html = fill(
    html,
    '/*__ROWS__*/',
    rows || '<tr><td colspan="10" class="muted">No reports yet.</td></tr>',
  )
  return html
}
