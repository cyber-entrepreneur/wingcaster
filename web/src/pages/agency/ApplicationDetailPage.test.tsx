// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApplicationDetailPage } from './ApplicationDetailPage'
import type { AgencyApplicationRaw } from './applicationsTypes'

const { addToast, apiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getMyAgency: vi.fn(),
    listAgencyApplications: vi.fn(),
    approveAgencyApplication: vi.fn(),
    rejectAgencyApplication: vi.fn(),
    revealAgencyApplicationContact: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: {
      id: 'usr_admin',
      email: 'owner@example.com',
      name: 'Owner',
      affiliation: { role: 'owner' },
    },
    loading: false,
  }),
}))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const SAMPLE: AgencyApplicationRaw[] = [
  {
    id: 'app_sara',
    agency_id: 'agc_1',
    applicant_user_id: 'usr_sara',
    agent_name: 'Sara Al Mansouri',
    agent_email: 'sara@example.com',
    agent_phone: '+971501234567',
    message: 'Hi,\n\nI have been agent-of-record at Elite.',
    current_listings_count: 14,
    portfolio_url: 'https://sara-portfolio.example.com',
    status: 'pending',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    city: 'Dubai',
    years_experience: 5,
  },
  {
    id: 'app_sara_prior',
    agency_id: 'agc_1',
    agent_name: 'Sara Al Mansouri',
    agent_email: 'sara@example.com',
    message: 'Prior application',
    status: 'rejected',
    created_at: '2026-03-12T10:00:00Z',
    rejected_at: '2026-03-15T10:00:00Z',
    rejection_reason: 'City not currently a focus for us',
  },
  {
    id: 'app_next',
    agency_id: 'agc_1',
    agent_name: 'Ahmed Khan',
    agent_email: 'ahmed@example.com',
    message: 'Next in queue',
    status: 'pending',
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
]

function renderDetail(path = '/agency/members/applications/app_sara?status=pending&within=30d') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agency/members/applications" element={<div data-testid="queue">queue</div>} />
        <Route
          path="/agency/members/applications/:applicationId"
          element={<ApplicationDetailPage />}
        />
        <Route path="/applications/:applicationId" element={<div data-testid="outcome">outcome</div>} />
        <Route path="/login" element={<div>login</div>} />
        <Route path="/agency" element={<div>agency home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function waitForDetailLoaded(name = /Sara Al Mansouri/) {
  await waitFor(() => expect(apiMock.listAgencyApplications).toHaveBeenCalled())
  await waitFor(() => {
    expect(document.body.textContent).toMatch(name)
  })
}

describe('ApplicationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getMyAgency.mockResolvedValue({ id: 'agc_1', slug: 'elite', my_role: 'owner' })
    apiMock.listAgencyApplications.mockResolvedValue(SAMPLE)
    apiMock.approveAgencyApplication.mockResolvedValue({ success: true })
    apiMock.rejectAgencyApplication.mockResolvedValue({ success: true })
    apiMock.revealAgencyApplicationContact.mockResolvedValue({ success: true, field: 'contact' })
  })

  it('loads applicant as h1 with message and sticky decision panel', async () => {
    renderDetail()
    await waitForDetailLoaded()
    expect(screen.getByRole('heading', { level: 1, name: /Sara Al Mansouri/ })).toBeTruthy()
    expect(document.body.textContent).toMatch(/MESSAGE FROM APPLICANT/)
    expect(document.body.textContent).toMatch(/agent-of-record at Elite/)
    expect(document.body.textContent).toMatch(/DECISION/)
    expect(screen.getByRole('button', { name: /Approve application/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Request more info/i })).toBeDisabled()
    expect(document.body.textContent).not.toMatch(/SIGNALS TO REVIEW/)
  })

  it('shows application history accordion when priors exist', async () => {
    renderDetail()
    await waitForDetailLoaded()
    expect(document.body.textContent).toMatch(/applied 1 time before/i)
    fireEvent.click(screen.getByText(/applied 1 time before/i))
    expect(document.body.textContent).toMatch(/Another agency/)
  })

  it('approve confirmation calls API then toasts Agent 4 deep-link', async () => {
    renderDetail()
    await waitForDetailLoaded()
    fireEvent.click(screen.getByRole('button', { name: /Approve application/i }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Approve and add to agency/i }))
    await waitFor(() => {
      expect(apiMock.approveAgencyApplication).toHaveBeenCalledWith('agc_1', 'app_sara', {
        role: 'agent',
        affiliation_mode: 'non_exclusive',
      })
    })
    expect(addToast).toHaveBeenCalled()
    const toastArg = addToast.mock.calls[0][0]
    expect(String(toastArg.description)).toContain('/applications/app_sara')
  })

  it('reject requires 20 characters', async () => {
    renderDetail()
    await waitForDetailLoaded()
    fireEvent.click(screen.getByRole('button', { name: /Reject application/i }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: /^Reject application$/i })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: 'Too short' },
    })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: {
        value: 'We are not adding agents in your city right now. Please reapply later.',
      },
    })
    expect(confirm).not.toBeDisabled()
  })

  it('only unmasks contact after reveal-contact API succeeds', async () => {
    renderDetail()
    await waitForDetailLoaded()
    expect(document.body.textContent).toMatch(/s\*\*\*@example\.com/)
    expect(document.body.textContent).not.toMatch(/sara@example\.com/)

    fireEvent.click(screen.getByRole('button', { name: /Show contact/i }))
    await waitFor(() => {
      expect(apiMock.revealAgencyApplicationContact).toHaveBeenCalledWith('agc_1', 'app_sara', {
        field: 'contact',
      })
    })
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/sara@example\.com/)
    })
  })

  it('keeps contact masked and toasts when reveal-contact fails', async () => {
    apiMock.revealAgencyApplicationContact.mockRejectedValueOnce(new Error('Rate limited'))
    renderDetail()
    await waitForDetailLoaded()
    fireEvent.click(screen.getByRole('button', { name: /Show contact/i }))
    await waitFor(() => {
      expect(addToast).toHaveBeenCalled()
    })
    expect(document.body.textContent).not.toMatch(/sara@example\.com/)
    expect(screen.getByRole('button', { name: /Show contact/i })).toBeTruthy()
  })

  it('shows not-found for unknown application id', async () => {
    renderDetail('/agency/members/applications/app_missing')
    await waitFor(() => expect(apiMock.listAgencyApplications).toHaveBeenCalled())
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Application not found/)
    })
    expect(screen.getByRole('link', { name: /Back to Applications/i })).toBeTruthy()
  })

  it('renders already-decided rejected panel without action buttons', async () => {
    renderDetail('/agency/members/applications/app_sara_prior')
    await waitForDetailLoaded()
    expect(screen.queryByRole('button', { name: /Approve application/i })).toBeNull()
    expect(document.body.textContent).toMatch(/Reason given/)
    expect(document.body.textContent).toMatch(/City not currently a focus/)
  })
})
