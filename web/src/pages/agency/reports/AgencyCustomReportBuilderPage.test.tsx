// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getAgencyCustomReportCatalog: vi.fn(),
  getAgencyCustomReport: vi.fn(),
  createAgencyCustomReport: vi.fn(),
  runAgencyCustomReport: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMock,
}))

const authMock = vi.hoisted(() => ({
  agent: {
    id: 'user-owner-1',
    affiliation: { agency_id: 'agency-1', role: 'owner' as string | undefined },
  } as { id: string; affiliation: { agency_id: string; role: string | undefined } },
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { AgencyCustomReportBuilderPage } from './AgencyCustomReportBuilderPage'

const CATALOG = {
  metrics: [
    { key: 'listings_count', label: 'Listings created', category: 'listings', aggregation: 'count' },
    { key: 'inquiries_count', label: 'Inquiries', category: 'leads', aggregation: 'count' },
  ],
  dimensions: [
    { key: 'agent', label: 'Agent' },
    { key: 'month', label: 'Month' },
  ],
}

function renderPage(path = '/agency/reports/custom/new') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agency/reports/custom/:id" element={<AgencyCustomReportBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  apiMock.getAgencyCustomReportCatalog.mockResolvedValue(CATALOG)
  apiMock.getAgencyCustomReport.mockResolvedValue({
    report: {
      id: 'report-1',
      agency_id: 'agency-1',
      name: 'Saved report',
      definition: { metrics: ['listings_count'], dimensions: [], filters: {} },
      created_by: 'user-owner-1',
      updated_by: 'user-owner-1',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
    permissions: { can_manage: true },
  })
  apiMock.createAgencyCustomReport.mockResolvedValue({
    report: {
      id: 'report-new',
      agency_id: 'agency-1',
      name: 'Untitled report',
      definition: { metrics: ['listings_count'], dimensions: [], filters: {} },
      created_by: 'user-owner-1',
      updated_by: 'user-owner-1',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
  })
  apiMock.runAgencyCustomReport.mockResolvedValue({
    definition: { metrics: ['listings_count'], dimensions: [], filters: {} },
    rows: [{ dimensions: {}, metrics: { listings_count: 3 } }],
    totals: { listings_count: 3 },
  })
})

afterEach(() => {
  cleanup()
})

describe('AgencyCustomReportBuilderPage', () => {
  it('loads catalog and shows builder panels', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Custom report builder')).toBeInTheDocument()
    })
    expect(screen.getByText('Listings created')).toBeInTheDocument()
    expect(apiMock.getAgencyCustomReportCatalog).toHaveBeenCalledTimes(1)
  })

  it('runs a report after selecting a metric', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByLabelText('Listings created')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Listings created'))
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await waitFor(() => {
      expect(apiMock.runAgencyCustomReport).toHaveBeenCalled()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('shows forbidden state for unauthorized members', async () => {
    authMock.agent.affiliation.role = 'member'
    apiMock.getAgencyCustomReportCatalog.mockRejectedValue({ status: 403 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/owner, admin, or finance access/i)).toBeInTheDocument()
    })
  })
})
