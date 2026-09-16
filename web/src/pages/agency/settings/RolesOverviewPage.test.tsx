// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { RolesOverviewPage } from './RolesOverviewPage'
import type { CapabilityPacksResponse } from './rolesTypes'

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
    listAgencyCapabilityPacks: vi.fn(),
    getMyAgency: vi.fn(),
    assignMemberCapabilityPacks: vi.fn(),
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

let authRole = 'owner'
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'usr_owner', affiliation: { role: authRole } }, loading: false }),
}))

function makePacks(overrides: Partial<CapabilityPacksResponse> = {}): CapabilityPacksResponse {
  return {
    agency_id: 'agc_1',
    packs: [
      {
        id: 'finance',
        kind: 'seeded',
        name: 'Finance',
        description: 'Billing, invoices, credit adjustments, payout approvals.',
        capability_summary: [
          { key: 'billing.payments.write', label: 'Bill payments' },
          { key: 'billing.payouts.approve', label: 'Approve payouts' },
          { key: 'billing.invoices.read', label: 'View invoices' },
          { key: 'billing.credits.adjust', label: 'Adjust credits' },
        ],
        capability_total: 7,
        member_count: 2,
        requires_two_person: true,
        editable: false,
      },
      {
        id: 'marketer',
        kind: 'seeded',
        name: 'Marketer',
        description: 'Listing publishing, portal syndication, social broadcast.',
        capability_summary: [{ key: 'listings.publish', label: 'Publish listings' }],
        capability_total: 6,
        member_count: 5,
        requires_two_person: false,
        editable: false,
      },
      {
        id: 'read_only',
        kind: 'seeded',
        name: 'Read-Only',
        description: 'View everything, change nothing.',
        capability_summary: [{ key: 'listings.read', label: 'View listings' }],
        capability_total: 12,
        member_count: 1,
        requires_two_person: false,
        editable: false,
      },
      {
        id: 'custom',
        kind: 'custom',
        name: 'Custom',
        description: 'Your agency’s own capability set.',
        capability_summary: [{ key: 'listings.publish', label: 'Publish listings' }],
        capability_total: 5,
        member_count: 3,
        requires_two_person: false,
        editable: true,
      },
    ],
    agency_meta: { owner_count: 2, member_count_total: 11 },
    ...overrides,
  }
}

function renderPage(path = '/agency/settings/roles') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agency/settings/roles" element={<RolesOverviewPage />} />
        <Route path="/agency/settings/roles/:packId" element={<div data-testid="detail-stub" />} />
        <Route path="/agency" element={<div>agency home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authRole = 'owner'
  localeState.isArabic = false
  apiMock.listAgencyCapabilityPacks.mockResolvedValue(makePacks())
  apiMock.getMyAgency.mockResolvedValue({
    id: 'agc_1',
    name: 'Elite',
    members: [
      { user_id: 'usr_1', name: 'Sara', email: 'sara@x.co', capability_packs: [] },
      { user_id: 'usr_2', name: 'Ahmed', email: 'ahmed@x.co', capability_packs: ['custom'] },
    ],
  })
  apiMock.assignMemberCapabilityPacks.mockResolvedValue({ membership: {}, packs: [] })
})

describe('RolesOverviewPage (AGN-ROL-001)', () => {
  it('renders the four packs with capability chips and member counts', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'Roles & permissions', level: 1 }),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Finance', level: 3 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Custom', level: 3 })).toBeTruthy()
    expect(screen.getByText('Bill payments')).toBeTruthy()
    // "+N more" chip since capability_total (7) > 4 shown
    expect(screen.getByRole('button', { name: /\+3 more/ })).toBeTruthy()
    expect(screen.getByText('Built-in packs')).toBeTruthy()
    expect(screen.getByText('Custom pack')).toBeTruthy()
  })

  it('navigates to the pack detail on card click', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Finance', level: 3 })
    fireEvent.click(screen.getByRole('link', { name: /View permissions — Finance/ }))
    expect(await screen.findByTestId('detail-stub')).toBeTruthy()
  })

  it('shows the Finance R11 warning when the agency has fewer than 2 owners', async () => {
    apiMock.listAgencyCapabilityPacks.mockResolvedValue(
      makePacks({ agency_meta: { owner_count: 1, member_count_total: 11 } }),
    )
    renderPage()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/second owner/i)
  })

  it('hides Assign for the read-only member persona', async () => {
    authRole = 'member'
    renderPage()
    await screen.findByRole('heading', { name: 'Finance', level: 3 })
    expect(screen.queryByRole('button', { name: 'Assign to members' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'View permissions' }).length).toBeGreaterThan(0)
  })

  it('opens the assign sheet and PATCHes the selected member’s packs', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Custom', level: 3 })
    const assignButtons = screen.getAllByRole('button', { name: 'Assign to members' })
    fireEvent.click(assignButtons[assignButtons.length - 1]) // Custom card
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(apiMock.getMyAgency).toHaveBeenCalled())
    // Sara has no packs yet → checkbox enabled
    const saraCheckbox = await within(dialog).findByRole('checkbox', { name: /Sara/ })
    fireEvent.click(saraCheckbox)
    fireEvent.click(within(dialog).getByRole('button', { name: /^Assign/ }))
    await waitFor(() =>
      expect(apiMock.assignMemberCapabilityPacks).toHaveBeenCalledWith('usr_1', {
        packs: ['custom'],
      }),
    )
  })

  it('renders an error state with retry when the packs request fails', async () => {
    apiMock.listAgencyCapabilityPacks.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    const retry = await screen.findByRole('button', { name: 'Retry' })
    apiMock.listAgencyCapabilityPacks.mockResolvedValue(makePacks())
    fireEvent.click(retry)
    expect(await screen.findByRole('heading', { name: 'Finance', level: 3 })).toBeTruthy()
  })

  it('renders forbidden state on 403', async () => {
    apiMock.listAgencyCapabilityPacks.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { status: 403 }),
    )
    renderPage()
    expect(await screen.findByText(/don’t have access/i)).toBeTruthy()
  })

  it('renders Arabic copy with rtl direction', async () => {
    localeState.isArabic = true
    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'الأدوار والصلاحيات', level: 1 })).toBeTruthy()
    expect(container.querySelector('[data-screen="AGN-ROL-001"]')?.getAttribute('dir')).toBe('rtl')
  })

  it('has no axe violations in the default loaded state', async () => {
    const { container } = renderPage()
    await screen.findByRole('heading', { name: 'Finance', level: 3 })
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations()
  })
})
