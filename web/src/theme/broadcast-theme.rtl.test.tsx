// @vitest-environment jsdom
/**
 * Visual contract for Broadcast: both modes resolve the page token,
 * numerals use the mono hook, and inline styles never carry a raw hex.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { applyLcMode } from '@/theme/mode'
import { Numeric } from '@/components/ui/numeric'
import { LoginPage } from '@/pages/LoginPage'

const css = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

const LIGHT_PAGE = css.match(/:root \{[\s\S]*?--lc-bg-page:\s*(#[0-9A-Fa-f]{3,8})/)?.[1]
const DARK_PAGE = css.match(/\[data-lc-mode="dark"\] \{[\s\S]*?--lc-bg-page:\s*(#[0-9A-Fa-f]{3,8})/)?.[1]

beforeAll(() => {
  if (!document.getElementById('broadcast-theme-css')) {
    const style = document.createElement('style')
    style.id = 'broadcast-theme-css'
    style.textContent = css
    document.head.appendChild(style)
  }
})

describe('Broadcast visual contract', () => {
  it('ships distinct light and dark page backgrounds', () => {
    expect(LIGHT_PAGE).toBe('#FAF8F7')
    expect(DARK_PAGE).toBe('#0C1533')
  })

  it.each(['light', 'dark'] as const)('resolves --lc-bg-page in %s mode', (mode) => {
    applyLcMode(mode)
    const expected = mode === 'dark' ? DARK_PAGE : LIGHT_PAGE
    const resolved = getComputedStyle(document.documentElement).getPropertyValue('--lc-bg-page').trim()
    if (resolved) {
      expect(resolved.toUpperCase()).toBe(expected!.toUpperCase())
    }
    expect(document.documentElement.getAttribute('data-lc-mode')).toBe(mode)
    expect(css).toContain('background: var(--lc-bg-page)')
  })

  it('marks numerals with the mono/tabular hook', () => {
    const { getByText } = render(<Numeric>12,500</Numeric>)
    const node = getByText('12,500')
    expect(node).toHaveAttribute('data-lc-numeric')
    expect(node.className).toMatch(/lc-data/)
    const font = getComputedStyle(node).fontFamily
    if (font) {
      expect(font.toLowerCase()).toMatch(/ibm plex mono|monospace|--lc-font-mono/)
    }
  })

  it('renders a top-level page without raw hex in inline styles (both modes)', () => {
    for (const mode of ['light', 'dark'] as const) {
      applyLcMode(mode)
      const view = render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>,
      )
      const hits = [...view.container.querySelectorAll('[style]')]
        .map((el) => el.getAttribute('style') || '')
        .filter((style) => /#[0-9A-Fa-f]{3,8}\b/.test(style))
      expect(hits).toEqual([])
      view.unmount()
    }
  })
})
