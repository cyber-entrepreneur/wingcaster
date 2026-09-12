// @vitest-environment jsdom
/**
 * SHR-MFA-005 — regenerate-only viewer (no GET of existing codes).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { StepUpProvider } from '@/components/mfa'
import { BackupCodesViewerPage } from './BackupCodesViewerPage'

const apiMock = vi.hoisted(() => ({
  twoFactorStatus: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  stepUp: vi.fn(),
  stepUpVerify: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMock,
  setElevatedToken: vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { email: 'agent@example.com' },
    loading: false,
  }),
}))

const FRESH = Array.from({ length: 10 }, (_, i) => `FRESH${i}-CODE`)

function renderViewer(url: string, state?: { backupCodes?: string[] }) {
  return render(
    <ToastProvider>
      <StepUpProvider>
        <MemoryRouter initialEntries={[{ pathname: url.split('?')[0], search: url.includes('?') ? `?${url.split('?')[1]}` : '', state }]}>
          <Routes>
            <Route path="/settings/2fa/backup-codes" element={<BackupCodesViewerPage />} />
            <Route path="/settings/2fa" element={<div>2FA settings</div>} />
          </Routes>
        </MemoryRouter>
      </StepUpProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.twoFactorStatus.mockResolvedValue({
    totp_enabled: true,
    preferred_2fa: 'totp',
    totp_enrolled_at: '2026-09-04T14:32:00Z',
    backup_codes_remaining: 8,
  })
  apiMock.regenerateBackupCodes.mockResolvedValue({
    backup_codes: FRESH,
    backup_codes_remaining: 10,
  })
  apiMock.stepUp.mockResolvedValue({
    challenge_id: 'step-1',
    method: 'totp',
    expires_at: new Date(Date.now() + 600_000).toISOString(),
  })
  apiMock.stepUpVerify.mockResolvedValue({
    elevated_token: 'elev',
    expires_in: 900,
    expires_at: new Date(Date.now() + 900_000).toISOString(),
    factor_used: 'totp',
  })
})

describe('SHR-MFA-005 regenerate-only viewer', () => {
  it('standing mode shows the remaining count, not stored codes', async () => {
    renderViewer('/settings/2fa/backup-codes')
    expect((await screen.findAllByRole('heading', { name: /^Backup codes$/i }))[0]).toBeInTheDocument()
    expect(screen.getAllByText(/You have/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText('8')[0]).toBeInTheDocument()
    expect(screen.queryByText(/You'll only see these codes once/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Regenerate backup codes/i })[0]).toBeInTheDocument()
  })

  it('first-view with router state shows codes once and requires save acknowledgement', async () => {
    const user = userEvent.setup()
    renderViewer('/settings/2fa/backup-codes?first-view=1', { backupCodes: FRESH })
    expect((await screen.findAllByRole('heading', { name: /Save your backup codes/i }))[0]).toBeInTheDocument()
    for (const code of FRESH) {
      expect(screen.getAllByText(code)[0]).toBeInTheDocument()
    }
    expect(document.querySelector('[data-backup-codes-grid]')).toBeInTheDocument()
    const done = screen.getAllByRole('button', { name: /Done — back to two-factor settings/i })[0]!
    expect(done).toBeDisabled()
    await user.click(screen.getAllByRole('checkbox')[0]!)
    expect(done).toBeEnabled()
  })

  it('regenerate requires step-up then confirmation before POSTing', async () => {
    const user = userEvent.setup()
    renderViewer('/settings/2fa/backup-codes')
    await user.click((await screen.findAllByRole('button', { name: /Regenerate backup codes/i }))[0]!)
    expect(await screen.findByRole('heading', { name: /Verify it['’]s you/i })).toBeInTheDocument()
    expect(apiMock.regenerateBackupCodes).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Digit 1 of 6'), '111111')
    await user.click(screen.getByRole('button', { name: /^Verify$/i }))

    await waitFor(() => expect(apiMock.stepUpVerify).toHaveBeenCalled())
    expect((await screen.findAllByText(/Regenerate backup codes\?/i))[0]).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Yes, regenerate/i })[0]!)
    await waitFor(() => expect(apiMock.regenerateBackupCodes).toHaveBeenCalled())
    expect((await screen.findAllByRole('heading', { name: /Save your backup codes/i }))[0]).toBeInTheDocument()
    expect(screen.getAllByText(FRESH[0]!)[0]).toBeInTheDocument()
  })

  it('print stylesheet targets the backup-codes grid and print-hide chrome', () => {
    const cssPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../print.css')
    const css = readFileSync(cssPath, 'utf8')
    expect(css).toMatch(/\[data-backup-codes-grid\]/)
    expect(css).toMatch(/\[data-print-hide\]/)
    expect(css).toMatch(/\[data-backup-codes-print-meta\]/)
  })
})
