// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { AgencyOnboardingPage } from './AgencyOnboardingPage'

expect.extend(toHaveNoViolations)

const AXE_OPTS = {
  rules: {
    'color-contrast': { enabled: false },
    'aria-valid-attr-value': { enabled: false },
    'nested-interactive': { enabled: false },
  },
} as const

const { addToast, apiMock, localeState } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getMyAgency: vi.fn(),
    getAgencyOnboardingState: vi.fn(),
    patchAgencyOnboardingState: vi.fn(),
  },
  localeState: { isArabic: false },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: localeState.isArabic ? 'ar' : 'en',
    isArabic: localeState.isArabic,
    dir: localeState.isArabic ? 'rtl' : 'ltr',
    setLocale: vi.fn(),
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/onboarding']}>
      <Routes>
        <Route path="/agency/onboarding" element={<AgencyOnboardingPage />} />
        <Route path="/agency" element={<div>agency home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localeState.isArabic = false
  apiMock.getMyAgency.mockResolvedValue({ id: 'agc_1', name: 'Elite' })
  apiMock.getAgencyOnboardingState.mockResolvedValue({
    checklist: { branding: true, billing: { done: true } },
    dismissed_forever: false,
  })
  apiMock.patchAgencyOnboardingState.mockResolvedValue({
    checklist: {},
    dismissed_forever: true,
  })
})

describe('AgencyOnboardingPage (AGN-DSH-002)', () => {
  it('greets the agency and renders the 7-task checklist with a progress ring', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'Welcome to WingCaster, Elite', level: 1 }),
    ).toBeTruthy()
    expect(screen.getByText('Complete your agency profile')).toBeTruthy()
    expect(screen.getByText('Set custom roles')).toBeTruthy()
    const ring = screen.getByRole('progressbar')
    expect(ring.getAttribute('aria-valuenow')).toBe('2')
    expect(ring.getAttribute('aria-valuemax')).toBe('7')
    // Completed tasks keep a Review CTA
    expect(screen.getAllByRole('link', { name: 'Review' }).length).toBe(2)
  })

  it('links the roles task to the AGN-ROL-001 route', async () => {
    renderPage()
    await screen.findByText('Set custom roles')
    const rolesCta = screen.getByRole('link', { name: 'Configure' })
    expect(rolesCta.getAttribute('href')).toBe('/agency/settings/roles')
  })

  it('dismisses via confirm and PATCHes dismissed_forever', async () => {
    renderPage()
    await screen.findByText('Complete your agency profile')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss for now' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() =>
      expect(apiMock.patchAgencyOnboardingState).toHaveBeenCalledWith('agc_1', {
        dismissed_forever: true,
      }),
    )
  })

  it('shows the celebration navigator card when all 7 tasks are done', async () => {
    apiMock.getAgencyOnboardingState.mockResolvedValue({
      checklist: {
        branding: true,
        invites: true,
        billing: true,
        portal: true,
        listing: true,
        roles: true,
        '2FA': true,
      },
      dismissed_forever: false,
    })
    renderPage()
    expect(
      await screen.findByRole('button', { name: /Take me to my dashboard/ }),
    ).toBeTruthy()
    expect(screen.getByText('Your agency is set up. Welcome to the network.')).toBeTruthy()
  })

  it('renders an error state with retry', async () => {
    apiMock.getMyAgency.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    const retry = await screen.findByRole('button', { name: 'Retry' })
    apiMock.getMyAgency.mockResolvedValue({ id: 'agc_1', name: 'Elite' })
    fireEvent.click(retry)
    expect(
      await screen.findByRole('heading', { name: 'Welcome to WingCaster, Elite', level: 1 }),
    ).toBeTruthy()
  })

  it('renders Arabic copy', async () => {
    localeState.isArabic = true
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'مرحبًا بك في وينغكاستر، Elite', level: 1 }),
    ).toBeTruthy()
  })

  it('has no axe violations', async () => {
    const { container } = renderPage()
    await screen.findByText('Complete your agency profile')
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations()
  })
})
