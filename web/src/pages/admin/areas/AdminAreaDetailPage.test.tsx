// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminAreaDetailPage } from './AdminAreaDetailPage'

const sampleArea = {
  id: 'area-1',
  name: 'Dubai Marina',
  slug: 'dubai-marina',
  level: 'neighborhood',
  status: 'scoring_enabled',
  center_latitude: 25.0805,
  center_longitude: 55.1403,
  summary: 'Waterfront community',
  lifestyle_profile: 'Active',
  investment_outlook: 'Strong rental yield',
  boundary_geojson: '{"type":"Polygon","coordinates":[[[55.14,25.08],[55.15,25.08],[55.15,25.09],[55.14,25.09],[55.14,25.08]]]}',
}

const {
  getAdminAreaDetailMock,
  updateAdminAreaMock,
  listAdminSourceTypesMock,
  refreshAreaGoogleSignalsMock,
  enableAreaScoringMock,
  disableAreaScoringMock,
} = vi.hoisted(() => ({
  getAdminAreaDetailMock: vi.fn(),
  updateAdminAreaMock: vi.fn(),
  listAdminSourceTypesMock: vi.fn(),
  refreshAreaGoogleSignalsMock: vi.fn(),
  enableAreaScoringMock: vi.fn(),
  disableAreaScoringMock: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    getAdminAreaDetail: getAdminAreaDetailMock,
    updateAdminArea: updateAdminAreaMock,
    listAdminSourceTypes: listAdminSourceTypesMock,
    createAdminAreaSource: vi.fn(),
    deleteAdminAreaSource: vi.fn(),
    refreshAreaGoogleSignals: refreshAreaGoogleSignalsMock,
    calculateAdminScores: vi.fn(),
    enableAreaScoring: enableAreaScoringMock,
    disableAreaScoring: disableAreaScoringMock,
    createAdminArea: vi.fn(),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true }),
}))

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
}))

function renderDetail(areaId = 'area-1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/areas/${areaId}`]}>
      <Routes>
        <Route path="/admin/areas/:id" element={<AdminAreaDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminAreaDetailPage (PA-ARE-002)', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    listAdminSourceTypesMock.mockResolvedValue({
      items: [{ id: 'st-1', name: 'Google Places', slug: 'google-places', archetype: 'google_places', input_method: 'google_places_api', is_active: true }],
    })
    getAdminAreaDetailMock.mockResolvedValue({
      area: sampleArea,
      sources: [{ id: 'src-1', area_id: 'area-1', source_type_id: 'st-1', name: 'Primary feed' }],
      google_budget: { monthly_spend_usd: 45, budget_usd_monthly: 50, quota_exceeded: false },
    })
    updateAdminAreaMock.mockResolvedValue({ ...sampleArea, summary: 'Updated summary' })
  })

  it('loads area detail and renders disclosure fields', async () => {
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'Dubai Marina' })).toBeInTheDocument()
    expect(screen.getByLabelText('Summary')).toHaveValue('Waterfront community')
    expect(screen.getByLabelText('Lifestyle profile')).toHaveValue('Active')
    expect(screen.getByText('Primary feed')).toBeInTheDocument()
  })

  it('shows quota-exceeded banner when budget is exhausted', async () => {
    getAdminAreaDetailMock.mockResolvedValueOnce({
      area: sampleArea,
      sources: [],
      google_budget: { monthly_spend_usd: 55, budget_usd_monthly: 50, quota_exceeded: true },
    })
    renderDetail()
    expect(await screen.findByTestId('quota-exceeded-banner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Refresh Google signals/i })).toBeDisabled()
  })

  it('saves updated disclosure fields', async () => {
    renderDetail()
    await screen.findByLabelText('Summary')
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Summary'))
    await user.type(screen.getByLabelText('Summary'), 'Updated summary')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      expect(updateAdminAreaMock).toHaveBeenCalledWith('area-1', expect.objectContaining({ summary: 'Updated summary' }))
    })
  })

  it('toggles scoring via enable/disable endpoints', async () => {
    disableAreaScoringMock.mockResolvedValue({ ...sampleArea, status: 'draft' })
    renderDetail()
    await screen.findByRole('button', { name: 'Disable scoring' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Disable scoring' }))
    await waitFor(() => expect(disableAreaScoringMock).toHaveBeenCalledWith('area-1'))
  })

  it('renders RTL-friendly Arabic summary field', async () => {
    renderDetail()
    const arField = await screen.findByLabelText('Summary (Arabic)')
    expect(arField).toHaveAttribute('dir', 'rtl')
  })
})
