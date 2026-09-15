#!/usr/bin/env node
/**
 * Run one vitest shard as sequential per-file processes.
 *
 * DOM-heavy suites leak across files inside a single forks worker until V8
 * OOMs (~4GB) on ubuntu-latest. Fresh processes reset RSS between files while
 * preserving vitest's contiguous shard slicing.
 *
 * Usage: node scripts/vitest-shard-serial.mjs <index>/<count> [--exclude <glob>] [filters...]
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')

function usage() {
  console.error(
    'Usage: node scripts/vitest-shard-serial.mjs <index>/<count> [--exclude <glob>] [filters...]',
  )
  process.exit(2)
}

const args = process.argv.slice(2)
if (args.length === 0) usage()

const shardArg = args.shift()
const m = /^(\d+)\/(\d+)$/.exec(shardArg || '')
if (!m) usage()
const index = Number(m[1])
const count = Number(m[2])
if (!(index >= 1 && index <= count)) usage()

const excludes = []
const filters = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--exclude') {
    const g = args[++i]
    if (!g) usage()
    excludes.push(g)
    continue
  }
  filters.push(args[i])
}

const listArgs = ['vitest', 'list', '--filesOnly', ...filters.flatMap((f) => [f])]
for (const g of excludes) listArgs.push('--exclude', g)

const listed = spawnSync('npx', listArgs, {
  cwd: webRoot,
  encoding: 'utf8',
  env: process.env,
})
if (listed.status !== 0) {
  process.stderr.write(listed.stderr || listed.stdout || '')
  process.exit(listed.status ?? 1)
}

const files = (listed.stdout || '')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  // vitest list may print non-file noise on stderr only; keep path-like lines
  .filter((l) => l.startsWith('src/') || l.startsWith('backend/'))

// Match vitest's contiguous shard slice (RandomSequencer / vitest 2.1).
const shardSize = Math.ceil(files.length / count)
const shardStart = shardSize * (index - 1)
const shardFiles = files.slice(shardStart, shardSize * index)

console.log(
  `vitest-shard-serial: shard ${index}/${count} → ${shardFiles.length} file(s) (of ${files.length})`,
)
if (shardFiles.length === 0) {
  console.log('No files in this shard; passing.')
  process.exit(0)
}

let failed = 0
for (const file of shardFiles) {
  console.log(`\n==> ${file}`)
  const run = spawnSync(
    'npx',
    ['vitest', 'run', file, '--passWithNoTests'],
    {
      cwd: webRoot,
      encoding: 'utf8',
      env: process.env,
      stdio: 'inherit',
    },
  )
  if (run.status !== 0) {
    failed += 1
    console.error(`FAILED ${file} (exit ${run.status})`)
    process.exit(run.status ?? 1)
  }
}

console.log(`\nvitest-shard-serial: ${shardFiles.length} file(s) passed`)
process.exit(failed === 0 ? 0 : 1)
