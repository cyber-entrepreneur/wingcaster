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
})
