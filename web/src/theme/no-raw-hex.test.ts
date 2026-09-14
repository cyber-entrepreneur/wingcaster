import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HEX = /#[0-9A-Fa-f]{3,8}\b/
const LEGACY = /--(wc|brand|gold|ink)-/
/** SHR-MFA-002: QR modules must be spec black/white — the only legal raw hex. */
const QR_ALLOWED_HEX = new Set(['#000', '#000000', '#fff', '#ffffff', '#FFF', '#FFFFFF'])
const QR_CONTEXT =
  /qrcode|QRCode|QrCode|qr-code|Authenticator QR|provisioning_uri|QR spec|QR exception/i

function hexHits(src: string): string[] {
  return [...src.matchAll(new RegExp(HEX, 'g'))].map((m) => m[0])
}

function isQrExceptionFile(rel: string, src: string): boolean {
  return /(^|\/).*qr.*/i.test(rel) || QR_CONTEXT.test(src)
}

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
      const rel = path.relative(SRC, file).replace(/\\/g, '/')
      const hits = hexHits(src)
      if (hits.length === 0) continue
      if (isQrExceptionFile(rel, src)) {
        const illegal = hits.filter((h) => !QR_ALLOWED_HEX.has(h))
        if (illegal.length) {
          offenders.push(`${rel} (QR hex must be #000/#fff only: ${illegal.join(', ')})`)
        }
        continue
      }
      offenders.push(rel)
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
