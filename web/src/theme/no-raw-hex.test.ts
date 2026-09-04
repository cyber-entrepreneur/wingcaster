import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HEX = /#[0-9A-Fa-f]{3,8}\b/
const LEGACY = /--(wc|brand|gold|ink)-/

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'broadcast-theme.css') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(tsx|ts|css)$/.test(name) && !name.includes('.test.') && !name.includes('.spec.')) acc.push(full)
  }
  return acc
}

describe('Broadcast token hygiene', () => {
  it('ui primitives, pages, and chrome contain no raw hex', () => {
    const files = walk(SRC)
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      if (HEX.test(src)) offenders.push(path.relative(SRC, file).replace(/\\/g, '/'))
    }
    expect(offenders).toEqual([])
  })

  it('contains no leftover --wc- / --gold- / --ink- / --brand- tokens', () => {
    const files = walk(SRC)
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      if (LEGACY.test(src)) offenders.push(path.relative(SRC, file).replace(/\\/g, '/'))
    }
    expect(offenders).toEqual([])
  })
})
