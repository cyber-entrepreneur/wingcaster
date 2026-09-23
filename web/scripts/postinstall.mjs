#!/usr/bin/env node
// Web install hook.
//
// Locally, installing web/ also installs the backend so a single
// `npm install` in web/ bootstraps the whole app (unchanged behavior).
//
// On Cloudflare Pages (which sets CF_PAGES=1) the backend is irrelevant to
// the static frontend build, and its native dependencies (e.g. better-sqlite3)
// can fail or bloat the Pages build — so skip the backend install there.
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

if (process.env.CF_PAGES) {
  console.log('[postinstall] CF_PAGES detected — skipping backend install (frontend-only build).')
  process.exit(0)
}

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend')
try {
  execSync('npm install', { cwd: backendDir, stdio: 'inherit' })
} catch (err) {
  console.error('[postinstall] backend install failed:', err.message)
  process.exit(1)
}
