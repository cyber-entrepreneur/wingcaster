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

  it('every used Tailwind palette class is aliased to a Broadcast token', () => {
    const ALIASED_PALETTES = new Set([
      'slate', 'gray', 'zinc',
      'red', 'rose',
      'amber', 'yellow',
      'green', 'emerald',
      'purple', 'violet', 'indigo',
      'blue', 'cyan',
      'pink',
      'orange',
    ])
    const KNOWN_TAILWIND_PALETTES = new Set([
      ...ALIASED_PALETTES,
      'stone', 'neutral',
      'lime', 'teal', 'sky', 'fuchsia',
    ])
    const paletteClassRe =
      /(?:bg|text|border|ring|from|to|via|shadow|divide|placeholder|outline|decoration|fill|stroke|caret|accent)(?:-(?:t|b|l|r|x|y|s|e|tl|tr|bl|br|start|end))?-([a-z]+)-\d+/g
    const src = walk(SRC)
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    const usedPalettes = new Set<string>()
    for (const match of src.matchAll(paletteClassRe)) {
      usedPalettes.add(match[1])
    }
    const unaliased = [...usedPalettes].filter(
      (p) => KNOWN_TAILWIND_PALETTES.has(p) && !ALIASED_PALETTES.has(p),
    )
    expect(unaliased).toEqual([])
  })
})
