// Writes reports/: a never-overwritten history file per run, latest-report.html,
// and index.html listing every run (from history/manifest.json).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { renderIndex } from './render.mjs'

const pad = (n) => String(n).padStart(2, '0')
const stamp = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`

export function reportPaths(root) {
  const dir = path.join(root, 'reports')
  return {
    dir,
    raw: path.join(dir, 'raw'),
    history: path.join(dir, 'history'),
    manifest: path.join(dir, 'history', 'manifest.json'),
    latest: path.join(dir, 'latest-report.html'),
    index: path.join(dir, 'index.html'),
  }
}

function readManifest(file) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveReport(root, model, html, startedAt) {
  const p = reportPaths(root)
  mkdirSync(p.history, { recursive: true })

  // Never overwrite: add a suffix if a report from the same second exists.
  const base = `${stamp(startedAt)}_${model.framework}`
  let file = `${base}.html`
  for (let i = 2; existsSync(path.join(p.history, file)); i++) file = `${base}-${i}.html`
  const historyFile = path.join(p.history, file)
  writeFileSync(historyFile, html, { flag: 'wx' })

  writeFileSync(p.latest, html)

  const entries = readManifest(p.manifest)
  entries.push({
    file,
    framework: model.framework,
    label: model.label,
    command: model.command,
    startedAt: model.startedAt,
    durationMs: model.durationMs,
    exitCode: model.exitCode,
    incomplete: model.incomplete,
    counts: model.counts,
  })
  writeFileSync(p.manifest, JSON.stringify(entries, null, 2))
  writeFileSync(p.index, renderIndex(entries))

  return { historyFile, latest: p.latest, index: p.index }
}
