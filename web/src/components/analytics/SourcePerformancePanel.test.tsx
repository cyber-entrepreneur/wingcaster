// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SourcePerformancePanel } from './SourcePerformancePanel'
import type { SourcePerformanceResponse, SourcePerformanceRow } from '@/api/client'

const apiMock = vi.hoisted(() => ({ getSourcePerformance: vi.fn() }))
const localeMock = vi.hoisted(() => ({ locale: 'en' as 'en' | 'ar', dir: 'ltr' as 'ltr' | 'rtl' }))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => localeMock }))

function row(source: string, over: Partial<SourcePerformanceRow> = {}): SourcePerformanceRow {
  return { source, conversations: 0, inquiries: 0, deals: 0, won: 0, won_value: 0, lead_share: 0, ...over }
}

function response(over: Partial<SourcePerformanceResponse> = {}): SourcePerformanceResponse {
  return {
    generated_at: '2026-09-18T20:00:00Z',
    scope: { agent_id: null, agency_id: null, start_date: null, end_date: null },
    totals: { conversations: 0, inquiries: 0, deals: 0, won: 0, won_value: 0 },
    sources: [],
    bazaar: row('bazaar'),
    ...over,
  }
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <SourcePerformancePanel />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.getSourcePerformance.mockReset()
  localeMock.locale = 'en'
  localeMock.dir = 'ltr'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SourcePerformancePanel', () => {
  it('renders the Bazaar metrics and per-source bars when there is activity', async () => {
    apiMock.getSourcePerformance.mockResolvedValue(
      response({
        totals: { conversations: 10, inquiries: 4, deals: 2, won: 1, won_value: 1000 },
        bazaar: row('bazaar', { conversations: 6, inquiries: 3, deals: 2, won: 1, won_value: 1000, lead_share: 60 }),
        sources: [
          row('bazaar', { conversations: 6, inquiries: 3, deals: 2, lead_share: 60 }),
          row('direct', { conversations: 4, inquiries: 1, deals: 0, lead_share: 40 }),
        ],
      }),
    )
    renderPanel()
    await screen.findByTestId('source-performance-panel')
    // Bazaar highlight shows its title and a drill link to the filtered inbox.
    expect(screen.getByRole('heading', { name: 'Real Estate Bazaar' })).toBeInTheDocument()
    const drill = screen.getByRole('link', { name: /View Bazaar leads/i })
    expect(drill).toHaveAttribute('href', '/dashboard/inbox?source=bazaar')
    // Per-source bars are present.
    expect(screen.getByText('Direct')).toBeInTheDocument()
  })

  it('shows the syndication nudge when Bazaar has no activity', async () => {
    apiMock.getSourcePerformance.mockResolvedValue(
      response({
        totals: { conversations: 3, inquiries: 0, deals: 0, won: 0, won_value: 0 },
        bazaar: row('bazaar'),
        sources: [row('direct', { conversations: 3, lead_share: 100 })],
      }),
    )
    renderPanel()
    await screen.findByTestId('source-performance-panel')
    expect(screen.getByText(/No Bazaar leads yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Manage listings/i })).toHaveAttribute('href', '/listings')
    expect(screen.queryByRole('link', { name: /View Bazaar leads/i })).not.toBeInTheDocument()
  })

  it('shows an empty state when there is no lead activity at all', async () => {
    apiMock.getSourcePerformance.mockResolvedValue(response())
    renderPanel()
    await screen.findByTestId('source-performance-panel')
    expect(screen.getByText(/No lead activity yet/i)).toBeInTheDocument()
  })

  it('shows an error state with retry that refetches', async () => {
    apiMock.getSourcePerformance.mockRejectedValueOnce(new Error('boom'))
    apiMock.getSourcePerformance.mockResolvedValueOnce(response())
    renderPanel()
    await screen.findByText(/Couldn't load source performance/i)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(apiMock.getSourcePerformance).toHaveBeenCalledTimes(2))
    await screen.findByText(/No lead activity yet/i)
  })

  it('mirrors the document direction for RTL', async () => {
    localeMock.locale = 'ar'
    localeMock.dir = 'rtl'
    apiMock.getSourcePerformance.mockResolvedValue(response())
    renderPanel()
    const panel = await screen.findByTestId('source-performance-panel')
    expect(panel).toHaveAttribute('dir', 'rtl')
  })
})
