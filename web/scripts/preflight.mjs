#!/usr/bin/env node
// @ts-check
/**
 * Local preflight — reproduce what CI actually runs, BEFORE pushing.
 *
 * Why this exists: PRs have repeatedly gone green locally (tsc + touched
 * tests) yet red in CI, because CI runs a WIDER scope than the obvious two
 * gates — theme visual/a11y/RTL snapshots, the full app suite, the backend
 * fast suite, and a Real-Postgres suite. Each missed shard costs a full
 * ~10-minute CI round-trip that a local run would have caught in seconds.
 *
 * This mirrors .github/workflows/web-tests.yml + backend-tests.yml so a
 * clean preflight ≈ green CI. It cannot run the Real-Postgres suite without
 * a database, so it prints exactly how to run that yourself.
 *
 *   node scripts/preflight.mjs            # full gate (default)
 *   node scripts/preflight.mjs --fast     # tsc + theme suites + build only
 *   node scripts/preflight.mjs --no-backend
 *   node scripts/preflight.mjs --list     # show gates without running
 *
 * Run from web/ (npm run preflight / npm run preflight:fast).
 * Bypass the pre-push hook intentionally with PREFLIGHT_SKIP=1 git push.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND_DIR = path.resolve(WEB_DIR, '..', 'backend')

const args = new Set(process.argv.slice(2))
const FAST = args.has('--fast')
const NO_BACKEND = args.has('--no-backend')
const LIST = args.has('--list')
const hasBackend = existsSync(BACKEND_DIR) && !NO_BACKEND

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

/** @typedef {{ name: string, cmd: string, cmdArgs: string[], cwd: string, tier: 'fast'|'full' }} Gate */

/** @type {Gate[]} */
const gates = [
  // --- web (mirrors web-tests.yml) ---
  { name: 'web · typecheck (tsc --noEmit)', cmd: npx, cmdArgs: ['tsc', '--noEmit'], cwd: WEB_DIR, tier: 'fast' },
  {
    name: 'web · theme suites (visual + a11y + rtl)',
    cmd: npx,
    cmdArgs: ['vitest', 'run', 'src/theme'],
    cwd: WEB_DIR,
    tier: 'fast',
  },
  {
    name: 'web · app suite (excl. src/theme)',
    cmd: npx,
    cmdArgs: ['vitest', 'run', '--exclude', 'src/theme/**'],
    cwd: WEB_DIR,
    tier: 'full',
  },
  { name: 'web · production build (vite build)', cmd: npx, cmdArgs: ['vite', 'build'], cwd: WEB_DIR, tier: 'fast' },
]

if (hasBackend) {
  // --- backend fast suite (mirrors backend-tests.yml "Fast suite (no real DB)") ---
  gates.push({
    name: 'backend · fast suite (no real DB)',
    cmd: npm,
    cmdArgs: ['test'],
    cwd: BACKEND_DIR,
    tier: 'full',
  })
}

const selected = gates.filter((g) => (FAST ? g.tier === 'fast' : true))

function hr() {
  console.log('─'.repeat(64))
}

if (LIST) {
  console.log(`Preflight gates (${FAST ? 'fast' : 'full'}):`)
  for (const g of selected) console.log(`  • ${g.name}`)
  console.log('\nNot run here (needs a database):')
  console.log('  • backend · Real-Postgres suite → cd ../backend && npm run test:pg:docker')
  process.exit(0)
}

console.log(`\n▶ Preflight (${FAST ? 'fast' : 'full'}) — reproducing CI locally\n`)

const results = []
const startAll = Date.now()

for (const g of selected) {
  hr()
  console.log(`▶ ${g.name}`)
  hr()
  const started = Date.now()
  const res = spawnSync(g.cmd, g.cmdArgs, { cwd: g.cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  const ok = res.status === 0
  results.push({ name: g.name, ok, secs })
  if (!ok) {
    console.error(`\n✖ FAILED: ${g.name} (exit ${res.status}, ${secs}s)`)
    printSummary(results)
    printRealPgReminder()
    process.exit(res.status || 1)
  }
  console.log(`✔ ${g.name} (${secs}s)`)
}

printSummary(results)
printRealPgReminder()
console.log(`\n✅ Preflight passed in ${((Date.now() - startAll) / 1000).toFixed(1)}s\n`)
process.exit(0)

/** @param {{name:string, ok:boolean, secs:string}[]} rows */
function printSummary(rows) {
  console.log('\n── preflight summary ──')
  for (const r of rows) console.log(`  ${r.ok ? '✔' : '✖'} ${r.name} (${r.secs}s)`)
}

function printRealPgReminder() {
  console.log('\nℹ Not covered by preflight (no local DB):')
  console.log('  • Real-Postgres suite asserts exact enum/constraint/key lists and')
  console.log('    only runs with a DB. If you touched a migration, DAL mapping, or a')
  console.log('    *.postgres.test.js assertion, run it:')
  console.log('        cd ../backend && npm run test:pg:docker')
  console.log('  • After changing any component prop/export/rendered text, grep the test')
  console.log('    tree for that name — a sibling test often hard-codes the old shape.\n')
}
