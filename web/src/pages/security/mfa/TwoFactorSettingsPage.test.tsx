// @vitest-environment jsdom
/**
 * SHR-MFA-001/002/003/006 — enrollment happy path + disable step-up + DISABLE.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { StepUpProvider } from '@/components/mfa'
import { TwoFactorSettingsPage } from './TwoFactorSettingsPage'
import { TotpEnrollPage } from './TotpEnrollPage'
import { BackupCodesViewerPage } from './BackupCodesViewerPage'

const apiMock = vi.hoisted(() => ({
  twoFactorStatus: vi.fn(),
  totpSetup: vi.fn(),
  totpVerify: vi.fn(),
  totpDisable: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  stepUp: vi.fn(),
  stepUpVerify: vi.fn(),
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
  provisioning_uri: 'otpauth://totp/WingCaster:a%40b.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=WingCaster',
  issuer: 'WingCaster',
  account: 'a@b.com',
}
const BACKUP_CODES = Array.from({ length: 10 }, (_, i) => `CODE${i}-ABCDE`)

function renderMfa(path = '/settings/2fa') {
  return render(
    <ToastProvider>
      <StepUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/settings/2fa" element={<TwoFactorSettingsPage />} />
            <Route path="/settings/2fa/enroll" element={<TotpEnrollPage />} />
            <Route path="/settings/2fa/backup-codes" element={<BackupCodesViewerPage />} />
            <Route path="/settings" element={<div>Settings home</div>} />
          </Routes>
        </MemoryRouter>
      </StepUpProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.twoFactorStatus.mockResolvedValue(DISABLED)
  apiMock.totpSetup.mockResolvedValue(SETUP)
  apiMock.totpVerify.mockResolvedValue({
    totp_enabled: true,
    totp_enrolled_at: '2026-09-04T14:32:00Z',
    backup_codes: BACKUP_CODES,
    backup_codes_remaining: 10,
  })
  apiMock.totpDisable.mockResolvedValue({ totp_enabled: false, token: 'new-token' })
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

describe('SHR-MFA enrollment happy path', () => {
  it('enables 2FA through password, QR, verify, and first-view backup codes', async () => {
    const user = userEvent.setup()
    renderMfa('/settings/2fa')

    expect(
      (await screen.findAllByRole('heading', { name: /Two-factor authentication/i }))[0],
    ).toBeInTheDocument()
    await user.click(
      (await screen.findAllByRole('button', { name: /Enable two-factor authentication/i }))[0]!,
    )

    expect((await screen.findAllByText(/Confirm your password/i))[0]).toBeInTheDocument()
    expect(apiMock.totpSetup).not.toHaveBeenCalled()

    await user.type(screen.getAllByLabelText(/Current password/i)[0]!, 'hunter2')
    await user.click(screen.getAllByRole('button', { name: /^Continue$/i })[0]!)

    await waitFor(() => expect(apiMock.totpSetup).toHaveBeenCalledWith('hunter2'))
    const qr = await screen.findAllByAltText(/QR code for setting up your authenticator app/i)
    expect(qr[0]).toHaveAttribute('src', 'data:image/png;base64,stub')

    await user.click(screen.getAllByRole('button', { name: /^Continue$/i })[0]!)
    expect(
      (await screen.findAllByRole('heading', { name: /Enter the code from your app/i }))[0],
    ).toBeInTheDocument()

    await user.type(screen.getAllByLabelText('Digit 1 of 6')[0]!, '123456')
    await user.click(screen.getAllByRole('button', { name: /Verify and enable/i })[0]!)

    await waitFor(() => expect(apiMock.totpVerify).toHaveBeenCalledWith(SETUP.secret, '123456'))
    expect((await screen.findAllByRole('heading', { name: /Save your backup codes/i }))[0]).toBeInTheDocument()
    for (const code of BACKUP_CODES) {
      expect(screen.getAllByText(code)[0]).toBeInTheDocument()
    }
    const done = screen.getAllByRole('button', { name: /Done — back to two-factor settings/i })[0]!
    expect(done).toBeDisabled()
    await user.click(screen.getAllByRole('checkbox', { name: /saved my backup codes/i })[0]!)
    expect(done).toBeEnabled()
  })
})

describe('SHR-MFA-006 disable requires step-up + typed DISABLE', () => {
  it('does not disable until step-up succeeds and DISABLE is typed', async () => {
    const user = userEvent.setup()
    apiMock.twoFactorStatus.mockResolvedValue(ENABLED)
    renderMfa('/settings/2fa')

    expect((await screen.findAllByText(/^On$/))[0]).toBeInTheDocument()
    await user.click(
      screen.getAllByRole('button', {
        name: /Turn off two-factor authentication \(reduces account security\)/i,
      })[0]!,
    )

    expect(await screen.findByRole('heading', { name: /Verify it['’]s you/i })).toBeInTheDocument()
    expect(apiMock.totpDisable).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Digit 1 of 6'), '654321')
    await user.click(screen.getByRole('button', { name: /^Verify$/i }))

    await waitFor(() => expect(apiMock.stepUpVerify).toHaveBeenCalled())
    expect((await screen.findAllByText(/Turn off two-factor authentication\?/i))[0]).toBeInTheDocument()
    const disableDialog = screen.getAllByRole('dialog').find((d) =>
      /Turn off two-factor authentication\?/i.test(d.textContent || ''),
    )
    expect(disableDialog).toBeTruthy()
    const dialog = within(disableDialog!)

    const turnOff = dialog.getByRole('button', {
      name: /Turn off two-factor authentication \(reduces account security\)/i,
    })
    expect(turnOff).toBeDisabled()

    await user.type(dialog.getByLabelText(/Enter a current 6-digit code/i), '123456')
    await user.type(dialog.getByLabelText(/Type DISABLE to confirm/i), 'disable')
    expect(turnOff).toBeDisabled()

    await user.clear(dialog.getByLabelText(/Type DISABLE to confirm/i))
    await user.type(dialog.getByLabelText(/Type DISABLE to confirm/i), 'DISABLE')
    expect(turnOff).toBeEnabled()

    await user.click(turnOff)
    await waitFor(() => expect(apiMock.totpDisable).toHaveBeenCalledWith('123456'))
  })
})
