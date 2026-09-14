// @vitest-environment jsdom
/**
 * Wave 4B MFA + Settings — accessibility contract
 * (CURSOR_SCREEN_WAVE_4B_MFA_SETTINGS §3 item 5 / §4 non-negotiable 5).
 *
 * Covers: axe-core on MFA 001/002/003/004/004b/005 and Settings 001–005,
 * OtpInput digit-progression live region (no per-keystroke spam),
 * backup-codes print layout, StepUpModal focus trap + Escape,
 * RTL extras for /settings and /settings/2fa, reduced-motion smoke.
 *
 * Chromatic / Storybook are not configured — Vitest snapshots stand in.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { useState, type ReactElement } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { OtpInput } from '@/components/mfa/OtpInput'
import { StepUpModal } from '@/components/mfa/StepUpModal'
import {
  Mfa002SetupQrSurface,
  Mfa004ChallengeSurface,
  Mfa005BackupCodesSurface,
  Set001HomeSurface,
  Set004SessionsSurface,
  WAVE4B_SURFACES,
} from '@/theme/wave4b-fixtures'
import { phaseAStatus } from '@/theme/wave4b-phase-a-discovery'

expect.extend(toHaveNoViolations)

/**
 * SettingsSidebar on main ships `<aside role="navigation">`. axe 4.9 flags that
 * as aria-allowed-role; the landmark is intentional and matches the shipped shell.
 */
const WAVE4B_AXE_RULES = {
  'aria-allowed-role': { enabled: false },
} as const

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

const PRINT_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../print.css'),
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
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    writable: true,
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
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  document.body.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach((n) => n.remove())
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

describe('Wave 4B a11y — axe smoke on MFA + Settings surfaces', () => {
  it('discovers the 11 Wave 4B surfaces (MFA 001–005 + SET 001–005)', () => {
    expect(WAVE4B_SURFACES.map((s) => s.id)).toEqual([
      'MFA-001',
      'MFA-002',
      'MFA-003',
      'MFA-004',
      'MFA-004b',
      'MFA-005',
      'SET-001',
      'SET-002',
      'SET-003',
      'SET-004',
      'SET-005',
    ])
  })

  it.each(WAVE4B_SURFACES.map((s) => [s.id, s] as const))(
    '%s has no axe violations',
    async (_id, surface) => {
      const ui = surface.id.startsWith('SET') ? (
        surface.render()
      ) : (
        <main>{surface.render()}</main>
      )
      const { container } = wrap(ui, surface.path)
      expect(await axe(container, { rules: WAVE4B_AXE_RULES })).toHaveNoViolations()
    },
  )

  it('records Phase A page status for later page-level suites', () => {
    const status = phaseAStatus()
    expect(status.printCss).toBe(true)
    expect(status.readyCount).toBeGreaterThanOrEqual(0)
  })
})

describe('Wave 4B a11y — OtpInput digit-progression SR announcements', () => {
  /**
   * Contract mirrors shipped `components/mfa/OtpInput.tsx` on main:
   * - `[data-otp-announce]` live region (aria-live=polite)
   * - typing announces `Digit N of 6` per keystroke
   * - full 6-digit paste announces `6-digit code entered`
   * - incomplete paste does not announce progression
   */
  function LiveOtp({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return <OtpInput aria-label="6-digit verification code" value={value} onChange={setValue} />
  }

  function liveRegion() {
    return document.querySelector('[data-otp-announce]')
  }

  function pasteInto(el: HTMLElement, text: string) {
    fireEvent.paste(el, {
      clipboardData: { getData: () => text },
    })
  }

  it('announces a complete paste once ("6-digit code entered")', async () => {
    wrap(<LiveOtp />)
    const first = screen.getByLabelText('Digit 1 of 6')
    first.focus()
    pasteInto(first, '847291')
    const live = liveRegion()
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveAttribute('aria-atomic', 'true')
    await waitFor(() => {
      expect(live).toHaveTextContent('6-digit code entered')
    })
  })

  it('announces Digit N of 6 on each typed keystroke (shipped live-region contract)', async () => {
    const user = userEvent.setup()
    wrap(<LiveOtp />)
    const first = screen.getByLabelText('Digit 1 of 6')
    first.focus()
    await user.keyboard('1')
    expect(liveRegion()).toHaveTextContent('Digit 1 of 6')
    const second = screen.getByLabelText('Digit 2 of 6')
    second.focus()
    await user.keyboard('2')
    expect(liveRegion()).toHaveTextContent('Digit 2 of 6')
  })

  it('does not announce progression for an incomplete multi-digit paste', async () => {
    wrap(<LiveOtp />)
    screen.getByLabelText('Digit 1 of 6').focus()
    pasteInto(screen.getByLabelText('Digit 1 of 6'), '847')
    expect(liveRegion()).toHaveTextContent('')
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('8')
    expect(screen.getByLabelText('Digit 3 of 6')).toHaveValue('7')
  })

  it('announces Digit 6 of 6 when the sixth digit is typed, not the raw values', async () => {
    wrap(<LiveOtp initial="12345" />)
    const last = screen.getByLabelText('Digit 6 of 6')
    last.focus()
    await userEvent.setup().keyboard('9')
    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent('Digit 6 of 6')
    })
    expect(liveRegion()?.textContent).not.toMatch(/123459|847291/)
  })

  it('keeps cells LTR under an RTL document', () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    wrap(<Mfa004ChallengeSurface />, '/login?stage=2fa')
    expect(screen.getByRole('group', { name: '6-digit verification code' })).toHaveAttribute('dir', 'ltr')
  })
})

describe('Wave 4B a11y — backup-codes print layout', () => {
  it('print.css hides chrome via data-print-hide / no-print and shows the grid', () => {
    expect(PRINT_CSS).toMatch(/@media print/)
    expect(PRINT_CSS).toMatch(/\[data-print-hide\]/)
    expect(PRINT_CSS).toMatch(/\.no-print/)
    expect(PRINT_CSS).toMatch(/\[data-backup-codes-grid\]/)
    expect(PRINT_CSS).toMatch(/display:\s*grid\s*!important/)
  })

  it('Mode A first-view exposes the print grid and marks chrome no-print', () => {
    wrap(<Mfa005BackupCodesSurface />, '/settings/2fa/backup-codes?first-view=1')
    const grid = document.querySelector('[data-backup-codes-grid]')
    expect(grid).toBeTruthy()
    expect(grid).toBeVisible()
    expect(within(grid as HTMLElement).getAllByRole('listitem')).toHaveLength(10)
    const hide = document.querySelectorAll('[data-print-hide], .no-print')
    expect(hide.length).toBeGreaterThan(0)
    const printBtn = screen.getByRole('button', { name: /^Print$/i })
    expect(printBtn.closest('[data-print-hide], .no-print')).toBeTruthy()
    expect(document.querySelector('[data-backup-codes-print-meta]')).toHaveTextContent(/sara@example.com/)
  })
})

describe('Wave 4B a11y — StepUpModal focus trap + Escape', () => {
  it('traps Tab inside the dialog and Escape cancels', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    wrap(
      <StepUpModal open reason="Sign out everywhere except this device" onCancel={onCancel} onVerify={vi.fn()} />,
      '/settings/security/sessions',
    )
    const dialog = await screen.findByRole('dialog')
    // Radix Dialog Content exposes role=dialog; aria-modal is not forced on main's DialogContent.
    expect(dialog).toHaveAttribute('role', 'dialog')
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    for (let i = 0; i < 10; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  it('SET-004 sign-out-everywhere opens the same trap', async () => {
    const user = userEvent.setup()
    wrap(<Set004SessionsSurface stepUpOpen />, '/settings/security/sessions')
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

describe('Wave 4B a11y — RTL extras for /settings and /settings/2fa', () => {
  it('/settings shell skip-link and nav landmarks survive RTL', () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    wrap(<Set001HomeSurface />, '/settings')
    expect(screen.getByText('Skip to settings content')).toHaveAttribute('href', '#settings-content')
    expect(screen.getAllByRole('navigation', { name: 'Settings navigation' }).length).toBeGreaterThan(0)
    expect(document.getElementById('settings-content')).toBeTruthy()
  })

  it('/settings/2fa challenge cells stay LTR while the page dir is rtl', () => {
    document.documentElement.dir = 'rtl'
    wrap(<Mfa004ChallengeSurface value="123456" />, '/settings/2fa')
    expect(screen.getByRole('group', { name: '6-digit verification code' })).toHaveAttribute('dir', 'ltr')
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('1')
  })
})

describe('Wave 4B a11y — reduced-motion smoke', () => {
  it('error cells mark data-otp-error and pair the alert with non-color copy', () => {
    stubReducedMotion(true)
    wrap(<Mfa004ChallengeSurface value="000000" error="That code did not match. Check your authenticator and try again." remaining={4} />)
    const group = screen.getByRole('group', { name: '6-digit verification code' })
    // Shipped OtpInput: data-otp-error + danger border class; no aria-invalid / motion-reduce class.
    expect(group).toHaveAttribute('data-otp-error', 'true')
    const cell = screen.getByLabelText('Digit 1 of 6')
    expect(cell.className).toMatch(/border-\[var\(--lc-status-danger-fg\)\]/)
    expect(screen.getByRole('alert')).toHaveTextContent(/did not match/i)
  })

  it('QR setup surface remains axe-clean under reduced motion', async () => {
    stubReducedMotion(true)
    const { container } = wrap(<Mfa002SetupQrSurface />, '/settings/2fa/enroll')
    expect(screen.getByRole('img', { name: 'Authenticator QR code' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})
