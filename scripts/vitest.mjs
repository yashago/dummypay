// Starts Vitest from a cwd with an upper-case Windows drive letter.
// VS Code terminals report `c:\...` while Node resolves packages as `C:\...`;
// the mismatch makes Vitest load two copies of itself ("failed to find the
// current suite"). Usage: node scripts/vitest.mjs <vitest args...>
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase())
const vitestBin = path.join(cwd, 'node_modules', 'vitest', 'vitest.mjs')

const result = spawnSync(process.execPath, [vitestBin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
