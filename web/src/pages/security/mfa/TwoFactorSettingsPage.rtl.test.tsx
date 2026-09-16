// @vitest-environment jsdom
/**
 * RTL + a11y coverage for the SHR-MFA-001 two-factor settings page and its
 * enrolment flow — ported from the legacy `pages/TotpSettingsPage.rtl.test.tsx`
 * onto the current landed page (`pages/security/mfa/TwoFactorSettingsPage`).
 *
 * Uses `document.documentElement.dir = 'rtl'` so the whole tree renders under
 * RTL, then asserts axe compliance on the three enrolment states that matter:
 *   - Off (initial)
 *   - Scan step (QR + manual key visible)
 *   - On (enrolled, disable button visible)
 *
 * Logical CSS properties (`me-2`, `ms-1`, `ps-9`, `text-start`) do the heavy
 * lifting; this suite pins that the page keeps working when the document
 * flips direction — the exact failure mode we want to catch before an Arabic-
 * locale user hits it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ToastProvider } from '@/components/ui/toast'
import { StepUpProvider } from '@/components/mfa'
import { TwoFactorSettingsPage } from './TwoFactorSettingsPage'
import { TotpEnrollPage } from './TotpEnrollPage'
import { BackupCodesViewerPage } from './BackupCodesViewerPage'

expect.extend(toHaveNoViolations)

const apiMock = vi.hoisted(() => ({
  twoFactorStatus: vi.fn(),
  totpSetup: vi.fn(),
  totpVerify: vi.fn(),
  totpDisable: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  stepUp: vi.fn(),
  stepUpVerify: vi.fn(),
  getSettingsIndex: vi.fn(),
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string
    checked?: boolean
    onCheckedChange?: (value: boolean) => void
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}))

vi.mock('@/api/client', () => ({
  api: apiMock,
  setAuthToken: vi.fn(),
  setElevatedToken: vi.fn(),
  clearElevatedToken: vi.fn(),
}))

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,stub') },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { email: 'agent@example.com' },
    loading: false,
    refreshAgent: vi.fn(),
  }),
}))

const DISABLED = {
  totp_enabled: false as const,
  preferred_2fa: 'email' as const,
  totp_enrolled_at: null,
  backup_codes_remaining: 0,
}
const ENABLED = {
  totp_enabled: true as const,
  preferred_2fa: 'totp' as const,
  totp_enrolled_at: '2026-09-04T14:32:00Z',
  backup_codes_remaining: 8,
}
const SETUP = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  provisioning_uri:
    'otpauth://totp/WingCaster:a%40b.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=WingCaster',
  issuer: 'WingCaster',
  account: 'a@b.com',
}
const BACKUP_CODES = Array.from({ length: 10 }, (_, i) => `CODE${i}-ABCDE`)

function renderRtl(path = '/settings/2fa') {
  return render(
    <ToastProvider>
      <StepUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/settings/2fa" element={<TwoFactorSettingsPage />} />
            <Route path="/settings/2fa/enroll" element={<TotpEnrollPage />} />
            <Route
              path="/settings/2fa/backup-codes"
              element={<BackupCodesViewerPage />}
            />
            <Route path="/settings" element={<div>Settings home</div>} />
          </Routes>
        </MemoryRouter>
      </StepUpProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.setAttribute('dir', 'rtl')
  document.documentElement.setAttribute('lang', 'ar')
  apiMock.twoFactorStatus.mockResolvedValue(DISABLED)
  apiMock.totpSetup.mockResolvedValue(SETUP)
  apiMock.totpVerify.mockResolvedValue({
    totp_enabled: true,
    totp_enrolled_at: '2026-09-04T14:32:00Z',
    backup_codes: BACKUP_CODES,
    backup_codes_remaining: 10,
  })
  apiMock.totpDisable.mockResolvedValue({ totp_enabled: false, token: 'new-token' })
  apiMock.getSettingsIndex.mockResolvedValue({ groups: [], capabilities: {} })
  apiMock.stepUp.mockResolvedValue({
    challenge_id: 'step-1',
    method: 'totp',
    expires_at: new Date(Date.now() + 600_000).toISOString(),
  })
  apiMock.stepUpVerify.mockResolvedValue({
    elevated_token: 'elev-token',
    expires_in: 900,
    expires_at: new Date(Date.now() + 900_000).toISOString(),
    factor_used: 'totp',
  })
})

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('lang')
})

describe('TwoFactorSettingsPage — RTL (Arabic locale)', () => {
  it('renders the off state under dir=rtl with no axe violations', async () => {
    const { container } = renderRtl('/settings/2fa')
    expect(
      (await screen.findAllByRole('heading', { name: /Two-factor authentication/i }))[0],
    ).toBeInTheDocument()
    // Direction is set at the document root, not on the page container. Assert it.
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders the enrolled state under dir=rtl with no axe violations', async () => {
    apiMock.twoFactorStatus.mockResolvedValue(ENABLED)
    const { container } = renderRtl('/settings/2fa')
    // "On" is the visible enrolled label per the new page (line 152 of source).
    expect((await screen.findAllByText(/^On$/))[0]).toBeInTheDocument()
    // Disable button must be reachable in RTL — logical `variant="destructive"`
    // is where a naive `float: left` would misplace the CTA.
    expect(
      screen.getAllByRole('button', {
        name: /Turn off two-factor authentication \(reduces account security\)/i,
      })[0],
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders the QR / scan step under dir=rtl with no axe violations', async () => {
    const user = userEvent.setup()
    const { container } = renderRtl('/settings/2fa')
    await user.click(
      (await screen.findAllByRole('button', { name: /Enable two-factor authentication/i }))[0]!,
    )
    // Password gate is the first sub-step; type it to reach QR.
    await user.type(screen.getAllByLabelText(/Current password/i)[0]!, 'hunter2')
    await user.click(screen.getAllByRole('button', { name: /^Continue$/i })[0]!)

    const qr = await screen.findAllByAltText(/QR code for setting up your authenticator app/i)
    expect(qr[0]).toHaveAttribute('src', 'data:image/png;base64,stub')
    // Manual-entry fallback (crucial when a device camera fails) is behind a
    // `<details>` + a `RevealableSecret` (starts blurred, click to reveal). We
    // don't need to unblur here — asserting the secret is in the DOM at all
    // proves it's reachable under RTL. The secret is rendered in 4-char
    // groups (`JBSW-Y3DP-…`), so match by the aria-labelled node.
    const details = container.querySelector('details')
    if (details) details.open = true
    await waitFor(() =>
      expect(
        screen.getAllByLabelText(/TOTP secret key/i)[0],
      ).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('surfaces "no backup codes left" alert under RTL when count is zero', async () => {
    apiMock.twoFactorStatus.mockResolvedValue({ ...ENABLED, backup_codes_remaining: 0 })
    const { container } = renderRtl('/settings/2fa')
    // TwoFactorSettingsPage.tsx:156-171 renders this alert whenever enabled &&
    // remaining <= 0. It embeds a "Regenerate now →" link that must be
    // reachable under RTL flow.
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/no backup codes left/i)
    expect(alert).toHaveTextContent(/Regenerate now/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})
