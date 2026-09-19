// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AgencyDeleteAgencyPage } from './AgencyDeleteAgencyPage'

const apiMock = vi.hoisted(() => ({
  getAgencyDeletionState: vi.fn(),
  regenerateAgencyDeletionWord: vi.fn(),
  initiateAgencyDeletion: vi.fn(),
  cancelAgencyDeletion: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/components/mfa', () => ({
  useStepUp: () => ({ requireStepUp: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() }),
}))

let isOwner = true
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: isOwner
      ? { id: 'usr_owner', affiliation: { agency_id: 'agc_1', role: 'owner' } }
      : { id: 'usr_admin', affiliation: { agency_id: 'agc_1', role: 'admin' } },
    loading: false,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/settings/delete-agency']}>
      <Routes>
        <Route path="/agency/settings/delete-agency" element={<AgencyDeleteAgencyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AgencyDeleteAgencyPage', () => {
  beforeEach(() => {
    isOwner = true
    apiMock.getAgencyDeletionState.mockReset()
    apiMock.getAgencyDeletionState.mockResolvedValue({
      agency: { id: 'agc_1', name: 'Coastal Realty' },
      impact: { active_members: 0, listings_count: 4, credits_balance_usd: 50, past_due_invoices: false },
      blocks: { active_members: false, past_due: false },
      deletion: null,
      can_schedule: true,
    })
  })

  it('renders impact summary for owners', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Delete agency')).toBeTruthy()
      expect(screen.getByText(/Coastal Realty/)).toBeTruthy()
      expect(screen.getByText(/4/)).toBeTruthy()
    })
    expect(document.querySelector('[data-screen="AGN-SET-006"]')).toBeTruthy()
  })

  it('shows forbidden state for non-owners', async () => {
    isOwner = false
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Only the agency owner/i)).toBeTruthy()
    })
  })

  it('shows scheduled state when deletion exists', async () => {
    apiMock.getAgencyDeletionState.mockResolvedValue({
      agency: { id: 'agc_1', name: 'Coastal Realty' },
      impact: { active_members: 0, listings_count: 4, credits_balance_usd: 50, past_due_invoices: false },
      blocks: { active_members: false, past_due: false },
      deletion: {
        id: 'del_1',
        status: 'scheduled',
        scheduled_for: '2026-10-18T00:00:00.000Z',
        reason: 'business_closed',
      },
      can_schedule: false,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Deletion scheduled')).toBeTruthy()
    })
  })
})
