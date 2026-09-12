// @vitest-environment jsdom
/**
 * Page-level axe on merged SHR-MFA pages (feat/wave-4b-mfa).
 * Primitive coverage remains in wave4b-screens.*.test.tsx.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { StepUpProvider } from '@/components/mfa'
import { TwoFactorSettingsPage } from '@/pages/security/mfa/TwoFactorSettingsPage'
import { TotpEnrollPage } from '@/pages/security/mfa/TotpEnrollPage'
import { BackupCodesViewerPage } from '@/pages/security/mfa/BackupCodesViewerPage'
import { LoginFlow } from '@/pages/security/mfa/LoginFlow'
import type { EnrollLocationState } from '@/pages/security/mfa/mfaShared'

expect.extend(toHaveNoViolations)

const apiMock = vi.hoisted(() => ({
  twoFactorStatus: vi.fn(),
  totpSetup: vi.fn(),
  totpVerify: vi.fn(),
  twoFactorChallenge: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  stepUp: vi.fn(),
  stepUpVerify: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    api: { ...actual.api, ...apiMock },
    setAuthToken: vi.fn(),
    setElevatedToken: vi.fn(),
    clearElevatedToken: vi.fn(),
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'u1', email: 'sara@example.com', name: 'Sara Agent' },
    loading: false,
    refreshAgent: vi.fn(),
  }),
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(async () => ({ ok: true as const })),
    dir: 'ltr' as const,
    isArabic: false,
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAA') },
}))

const SETUP: EnrollLocationState = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  provisioning_uri:
    'otpauth://totp/WingCaster:sara%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=WingCaster',
  issuer: 'WingCaster',
  account: 'sara@example.com',
}

const BACKUP_CODES = [
  'A7K9-M2P4-Q8R1',
  'B3N6-W1X5-Y9Z2',
  'C4D8-E2F7-G1H3',
  'J5K2-L9M8-N4P6',
  'Q1R7-S3T5-U8V0',
  'W2X4-Y6Z9-A1B3',
  'C8D1-E5F2-G7H4',
  'K3L6-M9N0-P2Q5',
  'R4S8-T1U7-V3W6',
  'X5Y2-Z8A4-B7C9',
]

function wrap(ui: ReactElement, entry: string | { pathname: string; search?: string; state?: unknown }) {
  const initial = typeof entry === 'string' ? [entry] : [entry]
  return render(
    <BrandProvider>
      <ToastProvider>
        <StepUpProvider>
          <MemoryRouter initialEntries={initial}>{ui}</MemoryRouter>
        </StepUpProvider>
      </ToastProvider>
    </BrandProvider>,
  )
}

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  vi.clearAllMocks()
  apiMock.twoFactorStatus.mockResolvedValue({
    totp_enabled: false,
    preferred_2fa: 'email',
    totp_enrolled_at: null,
    backup_codes_remaining: 0,
  })
  apiMock.totpSetup.mockResolvedValue(SETUP)
  apiMock.twoFactorChallenge.mockResolvedValue({
    token: 'jwt',
    agent: { id: '1', email: 'sara@example.com' },
    factor_used: 'totp',
  })
})

afterEach(() => {
  cleanup()
  document.body.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach((n) => n.remove())
})

describe('Wave 4B MFA pages — axe after Phase A merge', () => {
  it('MFA-001 TwoFactorSettingsPage has no axe violations', async () => {
    const { container } = wrap(
      <Routes>
        <Route path="/settings/2fa" element={<TwoFactorSettingsPage />} />
      </Routes>,
      '/settings/2fa',
    )
    expect(await screen.findByRole('heading', { name: /Two-factor authentication/i })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('MFA-002 TotpEnrollPage QR stage has no axe violations', async () => {
    const { container } = wrap(
      <Routes>
        <Route path="/settings/2fa/enroll" element={<TotpEnrollPage />} />
      </Routes>,
      { pathname: '/settings/2fa/enroll', state: SETUP },
    )
    expect(await screen.findByRole('heading', { name: /Scan this with your authenticator app/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /QR code/i })).toBeInTheDocument()
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('MFA-003 TotpEnrollPage verify stage has no axe violations', async () => {
    const { container } = wrap(
      <Routes>
        <Route path="/settings/2fa/enroll" element={<TotpEnrollPage />} />
      </Routes>,
      { pathname: '/settings/2fa/enroll', search: '?stage=verify', state: SETUP },
    )
    expect(await screen.findByRole('heading', { name: /Enter the code from your app/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '6-digit verification code' })).toHaveAttribute('dir', 'ltr')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('MFA-004 sign-in challenge has no axe violations', async () => {
    const { container } = wrap(
      <Routes>
        <Route path="/login" element={<LoginFlow />} />
      </Routes>,
      '/login?stage=2fa&challenge_id=ch-1',
    )
    expect(await screen.findByRole('heading', { name: /Verify it['’]s you/i })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('MFA-004b backup-code sign-in has no axe violations', async () => {
    const { container } = wrap(
      <Routes>
        <Route path="/login" element={<LoginFlow />} />
      </Routes>,
      '/login?stage=backup&challenge_id=ch-1',
    )
    expect(await screen.findByRole('heading', { name: /Enter a backup code/i })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('MFA-005 backup-codes first-view has no axe violations and exposes print grid', async () => {
    const { container } = wrap(
      <Routes>
        <Route path="/settings/2fa/backup-codes" element={<BackupCodesViewerPage />} />
      </Routes>,
      {
        pathname: '/settings/2fa/backup-codes',
        search: '?first-view=1',
        state: { backupCodes: BACKUP_CODES, accountEmail: 'sara@example.com' },
      },
    )
    await waitFor(() => {
      expect(document.querySelector('[data-backup-codes-grid]')).toBeTruthy()
    })
    expect(document.querySelectorAll('[data-print-hide], .no-print').length).toBeGreaterThan(0)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Wave 4B MFA pages — RTL extras', () => {
  it('/settings/2fa skip-link and OTP cells stay LTR under RTL', async () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    wrap(
      <Routes>
        <Route path="/settings/2fa" element={<TwoFactorSettingsPage />} />
        <Route path="/login" element={<LoginFlow />} />
      </Routes>,
      '/settings/2fa',
    )
    expect(await screen.findByText('Skip to settings content')).toHaveAttribute('href', '#settings-content')
    cleanup()
    wrap(
      <Routes>
        <Route path="/login" element={<LoginFlow />} />
      </Routes>,
      '/login?stage=2fa&challenge_id=ch-1',
    )
    expect(await screen.findByRole('group', { name: '6-digit verification code' })).toHaveAttribute('dir', 'ltr')
  })
})
