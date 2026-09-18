// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignStats: vi.fn(),
  updateCampaign: vi.fn(),
  createCampaign: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(() => 'test-token'),
  API_BASE: '/api',
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'agent-1', name: 'Test Agent' }, loading: false }),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { CampaignDetailPage } from '@/pages/CampaignDetailPage'

const campaign = {
  id: 'camp-1',
  name: 'Spring Nurture',
  description: 'Re-engage warm leads',
  status: 'active' as const,
  trigger: 'new_lead',
  target_channel: 'email',
  steps: [
    { step_index: 0, delay_hours: 0, channel: 'email', template_id: null, subject: 'Hi', body: 'Welcome' },
    { step_index: 1, delay_hours: 24, channel: 'whatsapp', template_id: null, subject: '', body: 'Follow up' },
  ],
  tags_filter: ['warm'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const stats = {
  campaign_id: 'camp-1',
  step_count: 2,
  totals: {
    enrolled: 3,
    active: 1,
    completed: 1,
    paused: 0,
    cancelled: 1,
    messages_total: 4,
    sent: 2,
    delivered: 0,
    failed: 1,
    skipped: 1,
    pending: 0,
    replied: 1,
    converted: 1,
  },
  channels: [
    { channel: 'email', total: 3, sent: 2, delivered: 0, failed: 0, skipped: 1 },
    { channel: 'whatsapp', total: 1, sent: 0, delivered: 0, failed: 1, skipped: 0 },
  ],
  steps: [
    { step_index: 0, channel: 'email', delay_hours: 0, total: 3, sent: 2, delivered: 0, failed: 0, skipped: 1 },
    { step_index: 1, channel: 'whatsapp', delay_hours: 24, total: 1, sent: 0, delivered: 0, failed: 1, skipped: 0 },
  ],
  enrollments: [
    { id: 'e1', contact_id: 'c1', contact_name: 'Alice Buyer', status: 'active' as const, current_step_index: 1, started_at: '2026-01-03T00:00:00Z', last_sent_at: null, next_run_at: '2026-01-04T00:00:00Z', completed_at: null },
    { id: 'e2', contact_id: 'c2', contact_name: 'Bob Seller', status: 'completed' as const, current_step_index: 2, started_at: '2026-01-02T00:00:00Z', last_sent_at: '2026-01-05T00:00:00Z', next_run_at: null, completed_at: '2026-01-05T00:00:00Z' },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/campaigns/camp-1']}>
      <Routes>
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/campaigns" element={<div>Campaigns list</div>} />
        <Route path="/contacts/:id" element={<div>Contact detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  addToast.mockReset()
  apiMocks.getCampaign.mockReset().mockResolvedValue(campaign)
  apiMocks.getCampaignStats.mockReset().mockResolvedValue(stats)
  apiMocks.updateCampaign.mockReset().mockResolvedValue({})
  apiMocks.createCampaign.mockReset().mockResolvedValue({ id: 'camp-2' })
})

afterEach(() => vi.restoreAllMocks())

describe('CampaignDetailPage', () => {
  it('renders the header, KPI strip and enrollment rows', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Spring Nurture')).toBeInTheDocument())
    expect(screen.getByText('Enrolled')).toBeInTheDocument()
    expect(screen.getByText('Replied')).toBeInTheDocument()
    expect(screen.getByText('Converted')).toBeInTheDocument()
    // Enrollment rows with contact links
    const alice = screen.getByRole('link', { name: 'Alice Buyer' })
    expect(alice).toHaveAttribute('href', '/contacts/c1')
    expect(screen.getByRole('link', { name: 'Bob Seller' })).toBeInTheDocument()
    // Per-channel breakdown
    expect(screen.getByText('By channel')).toBeInTheDocument()
    expect(screen.getByText('By step')).toBeInTheDocument()
  })

  it('pauses an active campaign', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Spring Nurture')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    await waitFor(() => expect(apiMocks.updateCampaign).toHaveBeenCalledWith('camp-1', { status: 'paused' }))
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
  })

  it('shows an error state with retry when loading fails', async () => {
    apiMocks.getCampaignStats.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    await waitFor(() => expect(screen.getByText("Couldn't load this campaign")).toBeInTheDocument())
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows an empty enrollment state when no contacts are enrolled', async () => {
    apiMocks.getCampaignStats.mockResolvedValue({
      ...stats,
      totals: { ...stats.totals, enrolled: 0 },
      enrollments: [],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Spring Nurture')).toBeInTheDocument())
    expect(screen.getByText('No contacts are enrolled in this campaign yet.')).toBeInTheDocument()
  })
})
