// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApplicationsQueuePage } from './ApplicationsQueuePage'
import {
  applicationOutcomePath,
  applicationStatusToLc,
  filterApplications,
  formatRelativeApplied,
  normalizeApplication,
  type AgencyApplicationRaw,
} from './applicationsTypes'

const { addToast, apiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getMyAgency: vi.fn(),
    listAgencyApplications: vi.fn(),
    approveAgencyApplication: vi.fn(),
    rejectAgencyApplication: vi.fn(),
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
    agent_name: 'Sara Al Mansouri',
    agent_email: 'sara@example.com',
    message:
      'Hi, I have been agent-of-record at Elite for 3 years and looking for a stronger MENA-wide platform.',
    current_listings_count: 14,
    status: 'pending',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    city: 'Dubai',
    years_experience: 5,
  },
  {
    id: 'app_ahmed',
    agency_id: 'agc_1',
    agent_name: 'Ahmed Khan',
    agent_email: 'ahmed@example.com',
    message: 'Interested in joining.',
    current_listings_count: 6,
    status: 'pending',
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    city: 'Abu Dhabi',
    years_experience: 2,
  },
  {
    id: 'app_old',
    agency_id: 'agc_1',
    agent_name: 'Old Approved',
    agent_email: 'old@example.com',
    message: 'Thanks',
    status: 'approved',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    approved_at: new Date().toISOString(),
  },
]

function renderQueue(path = '/agency/members/applications') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agency/members/applications" element={<ApplicationsQueuePage />} />
        <Route
          path="/agency/members/applications/:applicationId"
          element={<div data-testid="detail-stub">detail</div>}
        />
        <Route path="/login" element={<div>login</div>} />
        <Route path="/agency" element={<div>agency home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function waitForQueueLoaded() {
  await waitFor(() => expect(apiMock.listAgencyApplications).toHaveBeenCalled())
  await waitFor(() => {
    expect(document.body.textContent).toMatch(/Sara Al Mansouri/)
  })
}

describe('applicationsTypes helpers', () => {
  it('maps statuses to Broadcast LcStatus per brief', () => {
    expect(applicationStatusToLc('pending')).toBe('draft')
    expect(applicationStatusToLc('approved')).toBe('published')
    expect(applicationStatusToLc('rejected')).toBe('closed')
    expect(applicationStatusToLc('expired')).toBe('archived')
  })

  it('normalizes raw rows and filters by status/within/q', () => {
    const rows = SAMPLE.map(normalizeApplication)
    expect(rows[0].applicant.display_name).toBe('Sara Al Mansouri')
    expect(filterApplications(rows, { status: 'pending', within: 'all', q: '' })).toHaveLength(2)
    expect(filterApplications(rows, { status: 'pending', within: 'all', q: 'sara' })).toHaveLength(1)
    expect(filterApplications(rows, { status: 'approved', within: 'all', q: '' })).toHaveLength(1)
  })

  it('formats relative applied times with Numeric-friendly strings', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString()
    expect(formatRelativeApplied(twoHoursAgo)).toMatch(/2h ago/)
  })

  it('exposes Agent 4 outcome deep-link path', () => {
    expect(applicationOutcomePath('app_sara')).toBe('/applications/app_sara')
  })
})

describe('ApplicationsQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getMyAgency.mockResolvedValue({ id: 'agc_1', slug: 'elite', my_role: 'owner' })
    apiMock.listAgencyApplications.mockResolvedValue(SAMPLE)
    apiMock.approveAgencyApplication.mockResolvedValue({ success: true })
    apiMock.rejectAgencyApplication.mockResolvedValue({ success: true })
  })

  it('renders Applications title, pending rows, and uses PA queue filter strip', async () => {
    renderQueue()
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeTruthy()
    await waitForQueueLoaded()
    expect(screen.getByLabelText('Filter applications')).toBeTruthy()
    expect(screen.queryByLabelText('Risk tier')).toBeNull()
    expect(screen.getByLabelText('Applied within')).toBeTruthy()
    expect(screen.queryByLabelText('Select all visible rows')).toBeNull()
  })

  it('navigates to detail on row click', async () => {
    renderQueue()
    await waitForQueueLoaded()
    fireEvent.click(screen.getByText(/Sara Al Mansouri/))
    expect(await screen.findByTestId('detail-stub')).toBeTruthy()
  })

  it('approves a pending row via API with role + affiliation_mode', async () => {
    renderQueue()
    await waitForQueueLoaded()
    const approveButtons = screen.getAllByRole('button', { name: /Approve/i })
    fireEvent.click(approveButtons[0])
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

  it('requires reason before reject confirm', async () => {
    renderQueue()
    await waitForQueueLoaded()
    const rejectButtons = screen.getAllByRole('button', { name: /^Reject$/i })
    fireEvent.click(rejectButtons[0])
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: /Reject application/i })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: 'City not a focus right now' },
    })
    expect(confirm).not.toBeDisabled()
    fireEvent.click(confirm)
    await waitFor(() => {
      expect(apiMock.rejectAgencyApplication).toHaveBeenCalledWith('agc_1', 'app_sara', {
        reason: 'City not a focus right now',
      })
    })
  })

  it('opens keyboard shortcuts panel', async () => {
    renderQueue()
    await waitForQueueLoaded()
    fireEvent.click(screen.getByLabelText('Show keyboard shortcuts'))
    expect(await screen.findByRole('dialog', { name: /Keyboard shortcuts/i })).toBeTruthy()
    expect(screen.getByText('Next application')).toBeTruthy()
  })
})
