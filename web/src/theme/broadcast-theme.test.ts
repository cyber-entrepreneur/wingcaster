import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const css = readFileSync(path.join(repoRoot, 'docs/design-tokens/broadcast-theme.css'), 'utf8')

function countCustomProperties(block: string): number {
  const matches = block.match(/--lc-[a-z0-9-]+\s*:/g)
  return matches ? new Set(matches).size : 0
}

describe('broadcast-theme.css', () => {
  it('declares the full semantic --lc-* set on :root (127+ generated properties)', () => {
    const rootStart = css.indexOf(':root {')
    const darkStart = css.indexOf('[data-lc-mode="dark"] {')
    const root = css.slice(rootStart, darkStart === -1 ? undefined : darkStart)
    expect(countCustomProperties(root)).toBeGreaterThanOrEqual(127)
    for (const token of [
      '--lc-action-primary',
      '--lc-action-primary-hover',
      '--lc-focus-ring',
      '--lc-focus-ring-contrast',
      '--lc-tap-target-min',
      '--lc-font-mono',
      '--lc-status-published-fg',
      '--lc-channel-whatsapp',
    ]) {
      expect(root).toContain(`${token}:`)
    }
  })

  it('implements the two-tone focus ring and does not collapse it', () => {
    expect(css).toContain('box-shadow: 0 0 0 2px var(--lc-focus-ring), 0 0 0 4px var(--lc-focus-ring-contrast)')
    expect(css).toContain('Do not collapse this to a single outline')
  })

  it('sets the 44px tap-target floor on buttons', () => {
    expect(css).toContain('--lc-tap-target-min: 44px')
    expect(css).toContain('min-height: var(--lc-tap-target-min)')
  })

  it('applies tabular mono numerals to .lc-data and [data-lc-numeric]', () => {
    expect(css).toMatch(/:where\(\.lc-data, \[data-lc-numeric\]\)/)
    expect(css).toContain('font-family: var(--lc-font-mono)')
    expect(css).toContain('font-variant-numeric: tabular-nums')
  })

  it('switches dark via [data-lc-mode="dark"] and prefers-color-scheme', () => {
    expect(css).toContain('[data-lc-mode="dark"]')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(':root:not([data-lc-mode="light"])')
  })

  it('keeps dark-mode --lc-action-primary-hover darker (lower luma) than --lc-action-primary', () => {
    const luma = (hex: string) => {
      const n = hex.replace('#', '')
      const r = parseInt(n.slice(0, 2), 16)
      const g = parseInt(n.slice(2, 4), 16)
      const b = parseInt(n.slice(4, 6), 16)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const dark = css.slice(css.indexOf('[data-lc-mode="dark"]'))
    const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
    for (const block of [dark, media]) {
      const primary = block.match(/--lc-action-primary:\s*(#[0-9A-Fa-f]{6})/)?.[1]
      const hover = block.match(/--lc-action-primary-hover:\s*(#[0-9A-Fa-f]{6})/)?.[1]
      expect(primary).toBeTruthy()
      expect(hover).toBeTruthy()
      expect(luma(hover!)).toBeLessThan(luma(primary!))
    }
  })
})
