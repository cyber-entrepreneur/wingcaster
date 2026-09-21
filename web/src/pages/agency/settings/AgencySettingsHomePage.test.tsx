// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AgencySettingsHomePage } from './AgencySettingsHomePage'
import type { AgencySettingsOverview } from '@/types/agencySettings'

const { apiMock, localeState } = vi.hoisted(() => ({
  apiMock: { getAgencySettingsOverview: vi.fn() },
  localeState: { isArabic: false },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: localeState.isArabic ? 'ar' : 'en',
    isArabic: localeState.isArabic,
    dir: localeState.isArabic ? 'rtl' : 'ltr',
    setLocale: vi.fn(),
  }),
}))

function overviewFixture(overrides: Partial<AgencySettingsOverview> = {}): AgencySettingsOverview {
  return {
    agency: { id: 'ag-1', name: 'Acme Realty', slug: 'acme', license_number: 'LIC-9', accepting_applications: true },
    my_role: 'owner',
    stats: {
      member_count: 5,
      pending_applications: 3,
      mfa_required: true,
      pending_ownership_transfer: false,
      accepting_applications: true,
    },
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/settings']}>
      <AgencySettingsHomePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.getAgencySettingsOverview.mockReset()
  localeState.isArabic = false
})

afterEach(() => cleanup())

describe('AgencySettingsHomePage', () => {
  it('renders the agency name and live status badges for an owner', async () => {
    apiMock.getAgencySettingsOverview.mockResolvedValue(overviewFixture())
    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: /Acme Realty settings/i })).toBeInTheDocument())
    expect(screen.getByText('5 members')).toBeInTheDocument()
    expect(screen.getByText('3 pending')).toBeInTheDocument()
    expect(screen.getByText('2FA enforced')).toBeInTheDocument()
    // Owner-only card present
    expect(screen.getByRole('link', { name: /Ownership transfer/i })).toBeInTheDocument()
  })

  it('hides admin-only cards from a plain member', async () => {
    apiMock.getAgencySettingsOverview.mockResolvedValue(overviewFixture({ my_role: 'member' }))
    renderPage()

    await waitFor(() => expect(screen.getByRole('link', { name: /Members/i })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Price health/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Roles & permissions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ownership transfer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Audit log/i })).not.toBeInTheDocument()
  })

  it('shows an ownership-transfer-in-progress badge when one is pending', async () => {
    apiMock.getAgencySettingsOverview.mockResolvedValue(overviewFixture({
      stats: { member_count: 1, pending_applications: 0, mfa_required: false, pending_ownership_transfer: true, accepting_applications: false },
    }))
    renderPage()

    const link = await screen.findByRole('link', { name: /Ownership transfer/i })
    expect(within(link).getByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('2FA optional')).toBeInTheDocument()
  })

  it('shows a forbidden state on 403', async () => {
    apiMock.getAgencySettingsOverview.mockRejectedValue(Object.assign(new Error('nope'), { status: 403 }))
    renderPage()
    await waitFor(() => expect(screen.getByText(/need an active agency membership/i)).toBeInTheDocument())
  })

  it('shows an error state with retry on failure', async () => {
    const user = userEvent.setup()
    apiMock.getAgencySettingsOverview.mockRejectedValueOnce(new Error('boom'))
    apiMock.getAgencySettingsOverview.mockResolvedValueOnce(overviewFixture())
    renderPage()

    await waitFor(() => expect(screen.getByText(/couldn.t load your agency settings/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Try again/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /Acme Realty settings/i })).toBeInTheDocument())
  })

  it('renders under RTL', async () => {
    localeState.isArabic = true
    apiMock.getAgencySettingsOverview.mockResolvedValue(overviewFixture())
    renderPage()
    await waitFor(() => expect(document.querySelector('[data-screen="AGN-SET-001"]')).toHaveAttribute('dir', 'rtl'))
  })
})
