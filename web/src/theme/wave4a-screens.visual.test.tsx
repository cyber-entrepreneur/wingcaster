// @vitest-environment jsdom
/**
 * Wave 4A ONB / WLB / ACT — visual / DOM snapshot matrix.
 *
 * Chromatic / Storybook are not configured in this repo. These Vitest
 * snapshots stand in for the visual budget across light/dark × mobile/desktop
 * (and a focused RTL set) for the 15 activation-funnel surfaces.
 * See scratchpad/wave4a-chromatic-gap.md.
 *
 * Dark ≠ light byte-for-byte: serialize stamps resolved `--lc-*` values as
 * `data-lc-tokens` on the wrapper (jsdom class strings stay `var(--lc-*)`).
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
import {
  assertNoPiiBleed,
  serializeVisualRoot,
  setVisualViewport,
  stampLcTokens,
  type ViewportAxis,
} from '@/theme/visualSerialize'

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
  setVisualViewport('desktop')
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(FIXED_NOW)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  document.body.querySelectorAll('[data-radix-portal]').forEach((n) => n.remove())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function wrap(ui: ReactElement, pathName = '/onboarding/welcome') {
  return render(
    <MemoryRouter initialEntries={[pathName]}>
      <BrandProvider>
        <ToastProvider>
          <div data-wave4a-visual-root>{ui}</div>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

function snap(container: HTMLElement, mode: 'light' | 'dark'): string {
  const root =
    (container.querySelector('[data-wave4a-visual-root]') as HTMLElement | null) ?? container
  stampLcTokens(root, mode)
  const serialized = serializeVisualRoot(root, { mode })
  assertNoPiiBleed(serialized)
  return serialized
}

const MODES = ['light', 'dark'] as const
const VIEWPORTS: ViewportAxis[] = ['mobile', 'desktop']

describe('Wave 4A visual matrix — 15 surfaces × light/dark × mobile/desktop', () => {
  it.each(
    WAVE4A_SURFACES.flatMap((surface) =>
      MODES.flatMap((mode) =>
        VIEWPORTS.map((viewport) => [surface.id, mode, viewport, surface] as const),
      ),
    ),
  )('%s · %s · %s', (_id, mode, viewport, surface) => {
    applyLcMode(mode)
    setVisualViewport(viewport)
    document.documentElement.dir = 'ltr'
    document.documentElement.lang = 'en'
    const view = wrap(surface.render(), surface.path)
    expect(snap(view.container, mode)).toMatchSnapshot()
  })

  it('dark and light bodies differ after token stamp (theatrical-mode guard)', () => {
    const surface = WAVE4A_SURFACES.find((s) => s.id === 'ONB-001')!
    applyLcMode('light')
    setVisualViewport('desktop')
    const lightView = wrap(surface.render(), surface.path)
    const lightSnap = snap(lightView.container, 'light')
    cleanup()
    applyLcMode('dark')
    const darkView = wrap(surface.render(), surface.path)
    const darkSnap = snap(darkView.container, 'dark')
    expect(lightSnap).not.toEqual(darkSnap)
    expect(lightSnap).toContain('#FAF8F7')
    expect(darkSnap).toContain('#0C1533')
  })
})

describe('Wave 4A visual — RTL smoke (welcome, drafting, checklist, activate)', () => {
  it.each([
    ['ONB-001', 'light', 'desktop'] as const,
    ['WLB-004', 'dark', 'mobile'] as const,
    ['ONB-005', 'light', 'mobile'] as const,
    ['ACT-001', 'dark', 'desktop'] as const,
  ])('%s · rtl · %s · %s', (id, mode, viewport) => {
    applyLcMode(mode)
    setVisualViewport(viewport)
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    const surface = WAVE4A_SURFACES.find((s) => s.id === id)
    expect(surface).toBeTruthy()
    const view = wrap(surface!.render(), surface!.path)
    expect(snap(view.container, mode)).toMatchSnapshot()
  })
})

describe('Wave 4A visual — ONB-005 Pro pill + WLB-004 fallback', () => {
  it.each([
    ['light', 'ltr', 'desktop'],
    ['dark', 'rtl', 'mobile'],
  ] as const)('ONB-005 Pro pill · %s · %s · %s', (mode, dir, viewport) => {
    applyLcMode(mode)
    setVisualViewport(viewport)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const view = wrap(<Onb005ChecklistSurface completed={2} pro />, '/dashboard')
    expect(snap(view.container, mode)).toMatchSnapshot()
  })

  it.each([
    ['polling', 'light', 'desktop'],
    ['fallback', 'dark', 'mobile'],
  ] as const)('WLB-004 connection=%s · %s · %s', (connection, mode, viewport) => {
    applyLcMode(mode)
    setVisualViewport(viewport)
    const view = wrap(
      <Wlb004DraftingSurface connection={connection} />,
      '/onboarding/whatsapp/drafting/sess_1',
    )
    expect(snap(view.container, mode)).toMatchSnapshot()
  })
})
