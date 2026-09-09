// @vitest-environment jsdom
/**
 * Wave 4A ONB / WLB / ACT — visual / DOM snapshot matrix.
 *
 * Chromatic / Storybook are not configured in this repo. These Vitest
 * snapshots stand in for the visual budget across light/dark (and a
 * focused RTL set) for the 15 activation-funnel surfaces.
 * See scratchpad/wave4a-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import {
  FIXED_NOW,
  Onb005ChecklistSurface,
  WAVE4A_SURFACES,
  Wlb004DraftingSurface,
} from '@/theme/wave4a-fixtures'

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()

  if (!document.getElementById('broadcast-theme-css')) {
    const style = document.createElement('style')
    style.id = 'broadcast-theme-css'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }
})

beforeEach(() => {
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  applyLcMode('light')
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(FIXED_NOW)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
  document.body.querySelectorAll('[data-radix-portal]').forEach((n) => n.remove())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function wrap(ui: ReactElement, path = '/onboarding/welcome') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BrandProvider>
        <ToastProvider>{ui}</ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

/** Stabilize DOM for snapshots (ids, portals, countdown). */
function serialize(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[id]').forEach((el) => {
    const id = el.getAttribute('id') || ''
    if (id.startsWith('radix-') || id.includes(':') || /^r\d/.test(id)) {
      el.setAttribute('id', '__stable__')
    }
  })
  clone.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby], for').forEach((el) => {
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for'] as const) {
      if (el.hasAttribute(attr)) {
        const val = el.getAttribute(attr) || ''
        if (val.startsWith('radix-') || val.includes(':')) {
          el.setAttribute(attr, '__stable__')
        }
      }
    }
  })
  clone.querySelectorAll('[data-handshake-live]').forEach((el) => {
    el.textContent = 'Expires in __ minutes'
  })
  const portals = [
    ...document.body.querySelectorAll('[data-radix-portal], [role="dialog"], [role="alertdialog"]'),
  ]
    .map((node) => {
      const c = node.cloneNode(true) as HTMLElement
      c.querySelectorAll('[id]').forEach((el) => {
        const id = el.getAttribute('id') || ''
        if (id.startsWith('radix-') || id.includes(':')) el.setAttribute('id', '__stable__')
      })
      return c.outerHTML
    })
    .join('\n')
  const mode = document.documentElement.getAttribute('data-lc-mode') || 'light'
  const dir = document.documentElement.dir || 'ltr'
  const lang = document.documentElement.lang || 'en'
  return `<!-- mode=${mode} dir=${dir} lang=${lang} -->\n${clone.innerHTML}\n<!-- portals -->\n${portals}`
}

describe('Wave 4A visual matrix — 15 surfaces × light/dark', () => {
  it.each(
    WAVE4A_SURFACES.flatMap((surface) =>
      (['light', 'dark'] as const).map((mode) => [surface.id, mode, surface] as const),
    ),
  )('%s · %s', (_id, mode, surface) => {
    applyLcMode(mode)
    document.documentElement.dir = 'ltr'
    document.documentElement.lang = 'en'
    const view = wrap(surface.render(), surface.path)
    expect(serialize(view.container)).toMatchSnapshot()
  })
})

describe('Wave 4A visual — RTL smoke (welcome, drafting, checklist, activate)', () => {
  it.each([
    ['ONB-001', 'light'] as const,
    ['WLB-004', 'dark'] as const,
    ['ONB-005', 'light'] as const,
    ['ACT-001', 'dark'] as const,
  ])('%s · rtl · %s', (id, mode) => {
    applyLcMode(mode)
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    const surface = WAVE4A_SURFACES.find((s) => s.id === id)
    expect(surface).toBeTruthy()
    const view = wrap(surface!.render(), surface!.path)
    expect(serialize(view.container)).toMatchSnapshot()
  })
})

describe('Wave 4A visual — ONB-005 Pro pill + WLB-004 fallback', () => {
  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('ONB-005 Pro pill · %s · %s', (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const view = wrap(<Onb005ChecklistSurface completed={2} pro />, '/dashboard')
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['polling', 'light'],
    ['fallback', 'dark'],
  ] as const)('WLB-004 connection=%s · %s', (connection, mode) => {
    applyLcMode(mode)
    const view = wrap(
      <Wlb004DraftingSurface connection={connection} />,
      '/onboarding/whatsapp/drafting/sess_1',
    )
    expect(serialize(view.container)).toMatchSnapshot()
  })
})
