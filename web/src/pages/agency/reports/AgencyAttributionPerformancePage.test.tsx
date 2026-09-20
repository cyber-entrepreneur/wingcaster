// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AgencyAttributionPerformancePage } from './AgencyAttributionPerformancePage'

const { addToast, apiMock, localeState } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getAgencyAttributionPerformance: vi.fn(),
    getAgencyAttributionChain: vi.fn(),
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

let hasAgency = true
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: hasAgency
      ? { id: 'usr_owner', affiliation: { agency_id: 'agc_1', role: 'owner' } }
      : { id: 'usr_solo', affiliation: undefined },
    loading: false,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AgencyAttributionPerformancePage />
    </MemoryRouter>,
  )
}

const samplePerf = {
  generated_at: '2026-09-20T00:00:00.000Z',
  agency_id: 'agc_1',
  agent_id: null,
  model: 'last',
  configured: true,
  code: null,
  overview: {
    leads: 2,
    qualified: 1,
    viewings: 1,
    offers: 1,
    reservations: 1,
    transactions: 1,
    commissions: 1,
    gtv_micros: 500_000_000_000,
    commission_micros: 15_000_000_000,
    marketing_cost_micros: 3_000_000_000,
    roas: 5,
    roi: 4,
    currency: 'USD',
  },
  by_campaign: [{ campaign_id: 'cmp_1', leads: 1, commission_micros: 15_000_000_000, marketing_cost_micros: 3_000_000_000, roas: 5, roi: 4, gtv_micros: 500_000_000_000, qualified: 0, viewings: 0, offers: 0, reservations: 0, transactions: 1, commissions: 1, currency: 'USD' }],
  by_execution: [
    {
      execution_id: 'exec_1',
      campaign_id: null,
      leads: 1,
      qualified: 0,
      viewings: 0,
      offers: 0,
      reservations: 0,
      transactions: 1,
      commissions: 1,
      gtv_micros: 500_000_000_000,
      commission_micros: 15_000_000_000,
      marketing_cost_micros: 3_000_000_000,
      roas: 5,
      roi: 4,
      currency: 'USD',
    },
  ],
  conversions: [
    {
      id: 'cnv_1',
      contact_id: 'ctc_1',
      from_stage: 'reservation',
      to_stage: 'transaction',
      occurred_at: '2026-09-20T00:00:00.000Z',
      value_micros: 500_000_000_000,
      currency: 'USD',
    },
  ],
}

beforeEach(() => {
  hasAgency = true
  apiMock.getAgencyAttributionPerformance.mockReset()
  apiMock.getAgencyAttributionChain.mockReset()
  addToast.mockReset()
  localeState.isArabic = false
  apiMock.getAgencyAttributionPerformance.mockResolvedValue(samplePerf)
  apiMock.getAgencyAttributionChain.mockResolvedValue({
    conversion: samplePerf.conversions[0],
    model: 'last',
    configured: true,
    code: null,
    touchpoint_execution_ids: ['exec_1'],
    executions: [{ id: 'exec_1', kind: 'paid_ad', status: 'published', campaign_id: null }],
    credits: [{ id: 'acr_1', conversion_id: 'cnv_1', execution_id: 'exec_1', model: 'last', credit_weight: 1 }],
    credits_by_model: {},
  })
})

describe('AgencyAttributionPerformancePage', () => {
  it('renders attribution screen with funnel and ROAS', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Attribution & commission')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-REP-ATTR"]')).toBeTruthy()
    expect(screen.getAllByText('ROAS').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5.00x').length).toBeGreaterThan(0)
    expect(screen.getByText('— standalone')).toBeInTheDocument()
  })

  it('blocks non-agency users', async () => {
    hasAgency = false
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Agency access required')).toBeInTheDocument()
    })
    expect(apiMock.getAgencyAttributionPerformance).not.toHaveBeenCalled()
  })

  it('switches attribution model without inventing data-driven credits', async () => {
    const user = userEvent.setup()
    apiMock.getAgencyAttributionPerformance.mockImplementation(async (params?: { model?: string }) => {
      if (params?.model === 'data_driven') {
        return {
          ...samplePerf,
          model: 'data_driven',
          configured: false,
          code: 'NOT_CONFIGURED',
          by_execution: [],
          by_campaign: [],
        }
      }
      return { ...samplePerf, model: params?.model || 'last' }
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Attribution & commission')).toBeInTheDocument())
    await user.click(screen.getByRole('tab', { name: 'Data-driven' }))
    await waitFor(() => {
      expect(screen.getByText(/Data-driven model is not configured/i)).toBeInTheDocument()
    })
    expect(apiMock.getAgencyAttributionPerformance).toHaveBeenCalledWith({ model: 'data_driven' })
  })

  it('loads conversion attribution chain on drill-down', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('View chain')).toBeInTheDocument())
    await user.click(screen.getByText('View chain'))
    await waitFor(() => {
      expect(apiMock.getAgencyAttributionChain).toHaveBeenCalledWith('cnv_1', { model: 'last' })
      expect(screen.getByText(/exec_1 · standalone/)).toBeInTheDocument()
    })
  })

  it('supports RTL', async () => {
    localeState.isArabic = true
    renderPage()
    await waitFor(() => {
      expect(document.querySelector('[data-screen="AGN-REP-ATTR"]')?.getAttribute('dir')).toBe('rtl')
    })
  })
})
