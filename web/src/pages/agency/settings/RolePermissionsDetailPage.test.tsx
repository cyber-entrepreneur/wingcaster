// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { RolePermissionsDetailPage } from './RolePermissionsDetailPage'
import type { CapabilityPackDetailDto } from './rolesTypes'

expect.extend(toHaveNoViolations)

const AXE_OPTS = {
  rules: {
    'color-contrast': { enabled: false },
    'aria-valid-attr-value': { enabled: false },
    'nested-interactive': { enabled: false },
  },
} as const

const { apiMock, localeState } = vi.hoisted(() => ({
  apiMock: { getAgencyCapabilityPack: vi.fn() },
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

function makeDetail(kind: 'seeded' | 'custom' = 'custom'): CapabilityPackDetailDto {
  return {
    id: kind === 'custom' ? 'custom' : 'finance',
    kind,
    name: kind === 'custom' ? 'Custom' : 'Finance',
    description: 'Your agency’s own capability set.',
    editable: kind === 'custom',
    member_count: 3,
    members_preview: [
      { user_id: 'usr_1', display_name: 'Sara Al-Mansoori', avatar_url: null },
      { user_id: 'usr_2', display_name: 'Ahmed Nasser', avatar_url: null },
    ],
    domains: [
      {
        key: 'listings',
        label: 'Listings',
        capabilities: [
          {
            key: 'listings.create',
            label: 'Create listing',
            description: 'Create new property listings.',
            is_financial: false,
            enabled: true,
          },
          {
            key: 'listings.publish',
            label: 'Publish listing',
            description: 'Publish a listing to portals.',
            is_financial: false,
            enabled: false,
          },
        ],
      },
      {
        key: 'billing',
        label: 'Billing',
        capabilities: [
          {
            key: 'billing.payouts.approve',
            label: 'Approve payouts',
            description: 'Approve outgoing payouts.',
            is_financial: true,
            enabled: true,
          },
        ],
      },
    ],
  }
}

function renderPage(packId = 'custom') {
  return render(
    <MemoryRouter initialEntries={[`/agency/settings/roles/${packId}`]}>
      <Routes>
        <Route path="/agency/settings/roles/:packId" element={<RolePermissionsDetailPage />} />
        <Route path="/agency/settings/roles" element={<div>roles overview</div>} />
        <Route path="/agency" element={<div>agency home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localeState.isArabic = false
  apiMock.getAgencyCapabilityPack.mockResolvedValue(makeDetail('custom'))
})

describe('RolePermissionsDetailPage (AGN-ROL-002)', () => {
  it('renders the capability matrix with domains and the first domain expanded', async () => {
    renderPage('custom')
    expect(
      await screen.findByRole('heading', { name: 'Custom permissions', level: 1 }),
    ).toBeTruthy()
    // Listings auto-expanded → its capability is visible
    expect(screen.getByText('Create listing')).toBeTruthy()
    // Members section
    expect(screen.getByRole('heading', { name: 'Members with this pack' })).toBeTruthy()
  })

  it('expands a collapsed domain and shows the financial marking', async () => {
    renderPage('custom')
    await screen.findByRole('heading', { name: 'Custom permissions', level: 1 })
    const billingHeader = screen.getByRole('button', { name: /Billing/ })
    fireEvent.click(billingHeader)
    expect(screen.getByText('Approve payouts')).toBeTruthy()
    expect(screen.getByText(/requires two-person approval/i)).toBeTruthy()
  })

  it('shows the read-only banner for seeded packs with an Open Custom link', async () => {
    apiMock.getAgencyCapabilityPack.mockResolvedValue(makeDetail('seeded'))
    renderPage('finance')
    expect(await screen.findByText(/built-in pack — read only/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Custom' })).toBeTruthy()
  })

  it('renders a not-found state on 404', async () => {
    apiMock.getAgencyCapabilityPack.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { status: 404 }),
    )
    renderPage('nope')
    expect(await screen.findByRole('heading', { name: 'Pack not found.', level: 1 })).toBeTruthy()
  })

  it('renders Arabic copy', async () => {
    localeState.isArabic = true
    renderPage('custom')
    expect(await screen.findByRole('heading', { name: 'صلاحيات Custom', level: 1 })).toBeTruthy()
  })

  it('has no axe violations', async () => {
    const { container } = renderPage('custom')
    await screen.findByRole('heading', { name: 'Custom permissions', level: 1 })
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations()
  })
})
