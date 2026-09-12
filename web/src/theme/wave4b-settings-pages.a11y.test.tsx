// @vitest-environment jsdom
/**
 * Page-level axe + RTL checks against merged SHR-SET pages.
 * Primitive coverage remains in wave4b-screens.*.test.tsx.
 *
 * MFA-001..005 page modules land on feat/wave-4b-mfa. Until that branch
 * merges, `/settings/2fa` mounts the existing TotpSettingsPage placeholder
 * inside the settings shell.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { StepUpProvider } from '@/components/mfa'
import { SettingsPage } from '@/pages/SettingsPage'
import { settingsRoutes } from '@/pages/settings/routes'
import { TwoFactorSettingsPage } from '@/pages/security/mfa/TwoFactorSettingsPage'

expect.extend(toHaveNoViolations)

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

const apiMock = vi.hoisted(() => ({
  getSettingsIndex: vi.fn(),
  twoFactorStatus: vi.fn(),
  getAuthSessions: vi.fn(),
  getPushTokens: vi.fn(),
  getTenantSubscription: vi.fn(),
  getTenantInvoices: vi.fn(),
  getMyNotificationPreferences: vi.fn(),
  initiateDeleteAccount: vi.fn(),
  regenerateDeleteAccountWord: vi.fn(),
  patchMe: vi.fn(),
  deleteAuthSession: vi.fn(),
  deleteAuthSessionsExceptCurrent: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: apiMock }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: {
      id: 'u1',
      name: 'Sara Agent',
      email: 'sara@example.com',
      phone: '+971512345678',
      slug: 'sara.agent',
      preferred_locale: 'en',
      preferred_timezone: 'Asia/Dubai',
    },
    loading: false,
    updateProfile: vi.fn(),
    refreshAgent: vi.fn(),
  }),
}))

vi.mock('@/hooks/useLocale', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useLocale')>('@/hooks/useLocale')
  return {
    ...actual,
    useLocale: () => ({ locale: 'en', setLocale: vi.fn(), dir: 'ltr', isArabic: false }),
  }
})

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    activeTenant: { id: 't1', name: 'Elite Real Estate' },
    tenants: [],
    loading: false,
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAA') },
}))

const SOLO_INDEX = {
  capabilities: { billing: true, password: true, team: false },
  groups: [
    {
      id: 'account',
      label: 'Account',
      items: [{ id: 'profile', label: 'Account & profile', route: '/settings/account', icon: 'user' }],
    },
    {
      id: 'security',
      label: 'Security',
      items: [
        { id: 'two_factor', label: 'Two-factor authentication', route: '/settings/2fa', icon: 'shield' },
        { id: 'sessions', label: 'Sessions & devices', route: '/settings/sessions', icon: 'monitor' },
      ],
    },
    {
      id: 'billing',
      label: 'Billing & notifications',
      items: [
        { id: 'subscription', label: 'Subscription', route: '/settings/billing', icon: 'credit-card' },
      ],
    },
    {
      id: 'danger',
      label: 'Danger zone',
      items: [{ id: 'delete_account', label: 'Delete account', route: '/settings/delete-account', icon: 'trash-2' }],
    },
  ],
}

function renderSettings(path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BrandProvider>
        <ToastProvider>
          <StepUpProvider>
            <Routes>
              <Route path="/settings" element={<SettingsPage />}>
                {settingsRoutes}
              </Route>
              <Route path="/settings/2fa" element={<TwoFactorSettingsPage />} />
            </Routes>
          </StepUpProvider>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
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
  vi.clearAllMocks()
  apiMock.getSettingsIndex.mockResolvedValue(SOLO_INDEX)
  apiMock.twoFactorStatus.mockResolvedValue({ totp_enabled: false, backup_codes_remaining: 0 })
  apiMock.getAuthSessions.mockResolvedValue({
    sessions: [
      {
        id: 'ses_1',
        is_current: true,
        device_kind: 'desktop',
        device_summary: 'Chrome on macOS',
        ip: '1.1.1.1',
        ip_city: 'Dubai',
        ip_country: 'AE',
        last_active_at: '2026-09-12T11:58:00.000Z',
      },
    ],
  })
  apiMock.getPushTokens.mockResolvedValue({ tokens: [] })
  apiMock.getTenantSubscription.mockResolvedValue({
    subscription: { id: 's1', status: 'ACTIVE', display_name: 'Semsar', billing_cycle_end: '2026-10-15' },
    tenant_id: 't1',
  })
  apiMock.getTenantInvoices.mockResolvedValue({ invoices: [] })
  apiMock.getMyNotificationPreferences.mockResolvedValue({ preferences: [], event_kinds: [] })
  apiMock.initiateDeleteAccount.mockResolvedValue({ confirmation_word: 'SUNSET' })
  apiMock.regenerateDeleteAccountWord.mockResolvedValue({ word: 'harbor-lotus-ember' })
  apiMock.patchMe.mockResolvedValue({})
  apiMock.deleteAuthSession.mockResolvedValue({})
  apiMock.deleteAuthSessionsExceptCurrent.mockResolvedValue({ revoked: 1 })
})

afterEach(() => {
  cleanup()
  document.body.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach((n) => n.remove())
})

const PAGE_PATHS = [
  ['SET-001', '/settings', /Account & profile/i],
  ['SET-002', '/settings/account', /Profile photo/i],
  ['SET-003', '/settings/billing', /Your current plan/i],
  ['SET-004', '/settings/sessions', /Active sessions/i],
  ['SET-005', '/settings/delete-account', /Delete Account/i],
  ['MFA-001', '/settings/2fa', /Two-factor authentication/i],
] as const

describe('Wave 4B settings pages — axe after Phase A merge', () => {
  it.each(PAGE_PATHS)('%s (%s) has no axe violations', async (_id, path, ready) => {
    const { container } = renderSettings(path)
    expect(await screen.findByText('Skip to settings content')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText(ready).length).toBeGreaterThan(0)
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Wave 4B settings pages — RTL extras', () => {
  it('/settings skip-link and nav survive RTL', async () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    renderSettings('/settings')
    expect(await screen.findByText('Skip to settings content')).toHaveAttribute('href', '#settings-content')
    expect(screen.getAllByRole('navigation', { name: 'Settings navigation' }).length).toBeGreaterThan(0)
  })

  it('/settings/2fa is nested in the settings shell', async () => {
    document.documentElement.dir = 'rtl'
    renderSettings('/settings/2fa')
    expect(await screen.findByText('Skip to settings content')).toBeInTheDocument()
    expect(document.getElementById('settings-content')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: /Two-factor authentication/i })).toBeInTheDocument()
  })
})

describe('Wave 4B settings pages — SET-004 step-up trap', () => {
  it('sign-out-everywhere opens StepUpModal; Escape closes', async () => {
    const user = userEvent.setup()
    apiMock.getAuthSessions.mockResolvedValue({
      sessions: [
        {
          id: 'ses_1',
          is_current: true,
          device_kind: 'desktop',
          device_summary: 'Chrome on macOS',
          ip: '1.1.1.1',
          ip_city: 'Dubai',
          ip_country: 'AE',
          last_active_at: '2026-09-12T11:58:00.000Z',
        },
        {
          id: 'ses_2',
          is_current: false,
          device_kind: 'mobile',
          device_summary: 'Safari on iPhone',
          ip: '2.2.2.2',
          ip_city: 'Abu Dhabi',
          ip_country: 'AE',
          last_active_at: '2026-09-11T11:58:00.000Z',
        },
      ],
    })
    renderSettings('/settings/sessions')
    const bulk = await screen.findByRole('button', { name: /Sign out everywhere except this device/i })
    await user.click(bulk)
    const confirm = await screen.findByRole('dialog', { name: /Sign out of every other device/i })
    expect(confirm).toHaveAttribute('aria-modal', 'true')
    await user.click(within(confirm).getByRole('button', { name: /Sign out other devices/i }))
    const stepUp = await screen.findByRole('dialog', { name: /Verify/i })
    expect(stepUp).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => {
      expect(stepUp.contains(document.activeElement)).toBe(true)
    })
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Verify/i })).not.toBeInTheDocument()
    })
  })
})
