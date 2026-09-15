/**
 * Guardrail: UTF-8 BOM (\xEF\xBB\xBF) at file start breaks Postgres migrations
 * ("syntax error at or near ﻿") and cascades across the Real-PG suite.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const BOM = Buffer.from([0xef, 0xbb, 0xbf])

function assertNoBom(relPath) {
  const abs = join(root, relPath)
  const head = readFileSync(abs).subarray(0, 3)
  expect(head.equals(BOM), `${relPath} must not start with UTF-8 BOM`).toBe(false)
}

describe('no UTF-8 BOM in migrations / SLA workers', () => {
  it('migration SQL files are BOM-free', () => {
    const dir = join(root, 'src/persistence/migrations')
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.sql')) continue
      assertNoBom(`src/persistence/migrations/${name}`)
    }
  })

  it('SLA reaper worker sources are BOM-free', () => {
    assertNoBom('src/workers/sla-stuck-requests-reaper.js')
    assertNoBom('src/workers/sla-stuck-requests-reaper.test.js')
  })
})
