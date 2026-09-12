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
      expect(await axe(container)).toHaveNoViolations()
    },
  )

  it('records Phase A page status for later page-level suites', () => {
    const status = phaseAStatus()
    expect(status.printCss).toBe(true)
    expect(status.readyCount).toBeGreaterThanOrEqual(0)
  })
})

describe('Wave 4B a11y — OtpInput digit-progression SR announcements', () => {
  function LiveOtp({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return <OtpInput aria-label="6-digit verification code" value={value} onChange={setValue} />
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
    const live = screen.getByTestId('otp-progress')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveAttribute('aria-atomic', 'true')
    await waitFor(() => {
      expect(live).toHaveTextContent('6-digit code entered')
    })
  })

  it('does not spam the live region on each single keystroke', async () => {
    const user = userEvent.setup()
    wrap(<LiveOtp />)
    const live = screen.getByTestId('otp-progress')
    const first = screen.getByLabelText('Digit 1 of 6')
    first.focus()
    await user.keyboard('1')
    expect(live).toHaveTextContent('')
    expect(live.textContent).not.toMatch(/1 of 6/)
    const second = screen.getByLabelText('Digit 2 of 6')
    second.focus()
    await user.keyboard('2')
    expect(live).toHaveTextContent('')
    expect(live.textContent).not.toMatch(/2 of 6/)
  })

  it('announces a multi-digit paste that is not yet complete as N of 6', async () => {
    wrap(<LiveOtp />)
    screen.getByLabelText('Digit 1 of 6').focus()
    pasteInto(screen.getByLabelText('Digit 1 of 6'), '847')
    await waitFor(() => {
      expect(screen.getByTestId('otp-progress')).toHaveTextContent('3 of 6 digits entered')
    })
  })

  it('announces completion when the sixth digit is typed, not the values', async () => {
    wrap(<LiveOtp initial="12345" />)
    const last = screen.getByLabelText('Digit 6 of 6')
    last.focus()
    await userEvent.setup().keyboard('9')
    await waitFor(() => {
      expect(screen.getByTestId('otp-progress')).toHaveTextContent('6-digit code entered')
    })
    expect(screen.getByTestId('otp-progress').textContent).not.toMatch(/123459|847291/)
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
    expect(dialog).toHaveAttribute('aria-modal', 'true')
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
  it('error cells declare motion-reduce and do not rely on color alone', () => {
    stubReducedMotion(true)
    wrap(<Mfa004ChallengeSurface value="000000" error="That code did not match. Check your authenticator and try again." remaining={4} />)
    const group = screen.getByRole('group', { name: '6-digit verification code' })
    expect(group).toHaveAttribute('data-otp-error', 'true')
    expect(group).toHaveAttribute('aria-invalid', 'true')
    const cell = screen.getByLabelText('Digit 1 of 6')
    expect(cell.className).toMatch(/motion-reduce:transition-none/)
    expect(screen.getByRole('alert')).toHaveTextContent(/did not match/i)
  })

  it('QR setup surface remains axe-clean under reduced motion', async () => {
    stubReducedMotion(true)
    const { container } = wrap(<Mfa002SetupQrSurface />, '/settings/2fa/enroll')
    expect(screen.getByRole('img', { name: 'Authenticator QR code' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})
