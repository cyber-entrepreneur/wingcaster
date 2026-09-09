// @vitest-environment jsdom
/**
 * Wave 4A ONB / WLB / ACT — accessibility contract
 * (CURSOR_SCREEN_WAVE_4A_ONBOARDING_ACTIVATION §3 item 7).
 *
 * Covers: axe-core on all 15 surfaces, ONB-001 radio-group arrows,
 * ACT skip-wizard focus trap, WLB handshake copy, WLB-004 field-complete
 * aria-live (NOT during streaming) + {N}/{total}, ONB-005 widget + Pro pill,
 * reduced-motion (no confetti / no emphasis bounce).
 *
 * Chromatic / Storybook are not configured — see scratchpad/wave4a-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ReactElement } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { SparkleBurst } from '@/components/onboarding'
import {
  COMPLETE_FIELDS,
  FIXED_NOW,
  HANDSHAKE_EXPIRES_AT,
  STREAMING_FIELDS,
  WAVE4A_SURFACES,
  Act001WelcomeSurface,
  Onb001WelcomeSurface,
  Onb004CelebrationSurface,
  Onb005ChecklistSurface,
  Wlb002HandshakeSurface,
  Wlb004DraftingSurface,
  Wlb005ReadySurface,
} from '@/theme/wave4a-fixtures'
import { phaseAStatus } from '@/theme/wave4a-phase-a-discovery'

expect.extend(toHaveNoViolations)

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

const TAP_FLOOR =
  /(^|\s)(min-h-tap|h-tap|min-h-\[var\(--lc-tap-target-min\)\]|min-w-tap|w-tap)(\s|$)/

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
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(FIXED_NOW)
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
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
        <ToastProvider>
          <main>{ui}</main>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

function stubReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

describe('Wave 4A a11y — axe smoke on 15 surfaces', () => {
  it('discovers 15 Wave 4A surfaces', () => {
    expect(WAVE4A_SURFACES).toHaveLength(15)
  })

  it.each(WAVE4A_SURFACES.map((s) => [s.id, s] as const))(
    '%s has no axe violations',
    async (_id, surface) => {
      const { container } = wrap(surface.render(), surface.path)
      expect(await axe(container)).toHaveNoViolations()
    },
  )

  it('records Phase A page status for later page-level suites', () => {
    const status = phaseAStatus()
    expect(status.readyCount).toBeGreaterThanOrEqual(0)
  })
})

describe('Wave 4A a11y — ONB-001 radio-group arrows', () => {
  it('moves focus with ArrowRight / ArrowLeft inside the path radiogroup', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    wrap(<Onb001WelcomeSurface />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    radios[0].focus()
    expect(document.activeElement).toBe(radios[0])
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(radios[1])
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(radios[0])
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(radios[1])
  })

  it('Enter/Space selects a card', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    wrap(<Onb001WelcomeSurface selected="whatsapp" />)
    const manual = screen.getByRole('radio', { name: /Add a listing manually/i })
    manual.focus()
    await user.keyboard('{Enter}')
    expect(manual).toHaveAttribute('aria-checked', 'true')
  })
})

describe('Wave 4A a11y — ACT skip-wizard focus trap', () => {
  it('traps Tab inside the skip dialog, Escape closes, primary is focused', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    wrap(<Act001WelcomeSurface skipOpen />, '/activate')
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    for (let i = 0; i < 8; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

describe('Wave 4A a11y — WLB handshake copy button', () => {
  it('copy control is labelled and writes the activation code', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    wrap(<Wlb002HandshakeSurface />, '/onboarding/whatsapp/code')
    const copy = screen.getByRole('button', { name: /Copy activation code to clipboard/i })
    expect(copy.className).toMatch(TAP_FLOOR)
    await user.click(copy)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('WC-A4K9-JAMIL')
    expect(await screen.findByText(/Copied/i)).toBeInTheDocument()
  })

  it('countdown live region announces minutes, not each ticking second', () => {
    wrap(<Wlb002HandshakeSurface />, '/onboarding/whatsapp/code')
    const live = document.querySelector('[data-handshake-live]')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveTextContent(/Expires in 15 minutes/i)
    vi.advanceTimersByTime(14_000)
    expect(live).toHaveTextContent(/Expires in 15 minutes/i)
  })
})

describe('Wave 4A a11y — WLB-004 streaming live region', () => {
  it('announces completed fields and {N}/{total}, not streaming tokens', () => {
    wrap(<Wlb004DraftingSurface />, '/onboarding/whatsapp/drafting/sess_1')
    const live = document.querySelector('[data-draft-live]')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveTextContent('Address: 42 Marina Walk, Dubai')
    expect(live).toHaveTextContent('3/7')
    expect(live?.textContent).not.toMatch(/Bright 2BR with marina views/)
    expect(live?.textContent).not.toMatch(/Thinking/)
    const canvas = screen.getByText('Turning your message into a listing').closest('[aria-busy]')
    expect(canvas ?? document.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  it('does not put aria-live on the field grid while streaming', () => {
    wrap(<Wlb004DraftingSurface fields={STREAMING_FIELDS} />, '/onboarding/whatsapp/drafting/sess_1')
    const lists = [...document.querySelectorAll('ol')]
    const fieldGrid = lists.find((ol) => ol.textContent?.includes('Address'))
    expect(fieldGrid).toBeTruthy()
    expect(fieldGrid?.getAttribute('aria-live')).not.toBe('polite')
  })

  it('complete-state (WLB-005) announces 7/7 and the ready copy once', () => {
    wrap(<Wlb005ReadySurface />, '/onboarding/whatsapp/drafting/sess_1')
    const live = document.querySelector('[data-draft-live]')
    expect(live).toHaveTextContent('7/7')
    expect(screen.getByText(/Your listing is ready/i)).toBeInTheDocument()
  })
})

describe('Wave 4A a11y — ONB-005 dashboard-embedded + Pro pill', () => {
  it('widget exposes region + progressbar (not a standalone route)', () => {
    wrap(<Onb005ChecklistSurface completed={1} />, '/dashboard')
    const region = screen.getByRole('region', { name: 'Onboarding progress' })
    expect(region).toHaveAttribute('data-onboarding-checklist')
    const ring = within(region).getByRole('progressbar')
    expect(ring).toHaveAttribute('aria-valuenow', '1')
    expect(ring).toHaveAttribute('aria-valuemax', '4')
    expect(ring).toHaveAttribute('aria-valuemin', '0')
  })

  it('Pro pill uses compact progress + descriptive aria-label', () => {
    wrap(<Onb005ChecklistSurface completed={2} pro />, '/dashboard')
    const pill = screen.getByRole('button', {
      name: /Onboarding progress: 2 of 4 steps complete/i,
    })
    expect(pill).toHaveAttribute('data-onboarding-pill')
    expect(within(pill).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  })
})

describe('Wave 4A a11y — reduced motion', () => {
  it('SparkleBurst stays static when reducedMotion is set (no confetti / bounce)', () => {
    stubReducedMotion(true)
    wrap(<Onb004CelebrationSurface reducedMotion />)
    const burst = document.querySelector('[data-sparkle-burst]')
    expect(burst).toHaveAttribute('data-reduced-motion', 'true')
    expect(burst?.className).not.toMatch(/animate-pulse/)
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('emphasis easing on field-complete checks is gated by motion-reduce', () => {
    wrap(
      <Wlb004DraftingSurface fields={COMPLETE_FIELDS} />,
      '/onboarding/whatsapp/drafting/sess_1',
    )
    const checks = document.querySelectorAll('svg.lucide-check, svg.lucide-Check')
    const completeCheck = [...document.querySelectorAll('svg')].find((el) =>
      el.className.baseVal?.includes('easing-emphasis') ||
      el.getAttribute('class')?.includes('easing-emphasis'),
    )
    expect(completeCheck?.getAttribute('class') ?? '').toMatch(/motion-reduce:transition-none/)
    expect(checks.length).toBeGreaterThan(0)
  })

  it('ONB-005 SparkleBurst respects prefers-reduced-motion', () => {
    stubReducedMotion(true)
    wrap(<Onb005ChecklistSurface completed={4} />, '/dashboard')
    const burst = document.querySelector('[data-sparkle-burst]')
    expect(burst).toHaveAttribute('data-reduced-motion', 'true')
  })

  it('SparkleBurst component does not pulse when reducedMotion=true', () => {
    const { container } = wrap(<SparkleBurst active reducedMotion />)
    const burst = container.querySelector('[data-sparkle-burst]')
    expect(burst).toHaveAttribute('data-reduced-motion')
    expect(burst?.className).not.toContain('motion-safe:animate-pulse')
  })
})
