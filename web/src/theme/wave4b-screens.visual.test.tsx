// @vitest-environment jsdom
/**
 * Wave 4B MFA + Settings — visual / DOM snapshot matrix.
 *
 * Chromatic / Storybook are not configured in this repo. These Vitest
 * snapshots stand in for the visual budget across light/dark (and a
 * focused RTL set) matching nav-chrome.visual.test.tsx.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { StepUpModal } from '@/components/mfa/StepUpModal'
import {
  Mfa004ChallengeSurface,
  Mfa005BackupCodesSurface,
  Set001HomeSurface,
  Set004SessionsSurface,
  WAVE4B_SURFACES,
} from '@/theme/wave4b-fixtures'

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
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function wrap(ui: ReactElement, path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BrandProvider>
        <ToastProvider>
          <Routes>
            <Route path="*" element={ui} />
          </Routes>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

/** Stabilize DOM for snapshots (ids, portals). */
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

describe('Wave 4B visual matrix — 11 surfaces × light/dark', () => {
  it.each(
    WAVE4B_SURFACES.flatMap((surface) =>
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

describe('Wave 4B visual — RTL smoke (challenge, backup codes, settings, sessions)', () => {
  it.each([
    ['MFA-004', 'light'] as const,
    ['MFA-005', 'dark'] as const,
    ['SET-001', 'light'] as const,
    ['SET-004', 'dark'] as const,
  ])('%s · rtl · %s', (id, mode) => {
    applyLcMode(mode)
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    const surface = WAVE4B_SURFACES.find((s) => s.id === id)
    expect(surface).toBeTruthy()
    const view = wrap(surface!.render(), surface!.path)
    expect(serialize(view.container)).toMatchSnapshot()
  })
})

describe('Wave 4B visual — StepUpModal + print chrome (light/dark)', () => {
  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('StepUpModal open · %s · %s', (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const view = wrap(
      <StepUpModal open reason="Sign out everywhere except this device" onCancel={() => {}} onVerify={() => {}} />,
    )
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('backup-codes print-ready · %s · %s', (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const view = wrap(<Mfa005BackupCodesSurface confirmed />, '/settings/2fa/backup-codes?first-view=1')
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('settings home · %s · %s', (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const view = wrap(<Set001HomeSurface />, '/settings')
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('sessions + step-up · %s · %s', (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const view = wrap(<Set004SessionsSurface stepUpOpen />, '/settings/security/sessions')
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('2fa challenge ready · %s · %s', (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const view = wrap(<Mfa004ChallengeSurface value="847291" />, '/login?stage=2fa')
    expect(serialize(view.container)).toMatchSnapshot()
  })
})

describe('Wave 4B visual — reduced-motion smoke', () => {
  it('MFA-004 error cells stay token-driven under prefers-reduced-motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
    applyLcMode('light')
    const view = wrap(
      <Mfa004ChallengeSurface
        value="000000"
        error="That code did not match. Check your authenticator and try again."
        remaining={4}
      />,
    )
    expect(serialize(view.container)).toMatchSnapshot()
  })
})
