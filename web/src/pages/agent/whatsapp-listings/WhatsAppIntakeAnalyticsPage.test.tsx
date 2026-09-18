// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { WhatsAppIntakeAnalytics } from '@/api/client'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getWhatsAppListingsAgentAnalytics: vi.fn(),
}))
const uiMode = vi.hoisted(() => ({ shouldRenderPro: true }))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/hooks/useUiMode', () => ({ useUiMode: () => uiMode }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { WhatsAppIntakeAnalyticsPage } from './WhatsAppIntakeAnalyticsPage'
import { analyticsCsv, bucketActivity } from './analytics-utils'

const DATA: WhatsAppIntakeAnalytics = {
  range: {
    key: '30d',
    days: 30,
    from: '2026-08-20T00:00:00.000Z',
    to: '2026-09-18T23:59:59.999Z',
  },
  summary: {
    total_drafts: 12,
    approved: 9,
    approval_rate: 75,
    avg_approval_minutes: 18,
    ai_cost_estimate_usd: 1.2345,
  },
  activity: [
    { date: '2026-09-16', drafts: 2, approved: 1 },
    { date: '2026-09-17', drafts: 4, approved: 3 },
    { date: '2026-09-18', drafts: 6, approved: 5 },
  ],
  field_accuracy: [
    { field: 'title', label: 'Title', accuracy: 96, sample_size: 12, corrected_count: 1 },
    { field: 'price', label: 'Price', accuracy: 88, sample_size: 10, corrected_count: 1 },
  ],
  field_accuracy_basis: 'accepted_without_correction',
  quota: { used: 12, max: 100 },
  total_drafts: 12,
  published: 9,
  discarded: 1,
  awaiting_approval: 2,
  approval_rate: 75,
}

function renderPage({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' } = {}) {
  return render(
    <div dir={dir}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/agent/whatsapp-listings/analytics']}>
          <WhatsAppIntakeAnalyticsPage />
        </MemoryRouter>
      </ToastProvider>
    </div>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  uiMode.shouldRenderPro = true
  apiMock.getWhatsAppListingsAgentAnalytics.mockResolvedValue(DATA)
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:analytics'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('WhatsAppIntakeAnalyticsPage', () => {
  it('renders the Pro KPIs, trend, and correction-based accuracy breakdown', async () => {
    renderPage()

    expect(await screen.findByText('WhatsApp intake analytics')).toBeInTheDocument()
    expect(screen.getAllByText('Drafts').length).toBeGreaterThan(0)
    expect(screen.getByText('Approval rate')).toBeInTheDocument()
    expect(screen.getByText('Average approval time')).toBeInTheDocument()
    expect(screen.getByText('Estimated AI cost')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Title accuracy' })).toHaveAttribute(
      'aria-valuenow',
      '96',
    )
    expect(screen.getAllByText(/accepted without correction/i).length).toBeGreaterThan(0)
  })

  it('shows only the two core KPIs in Guided mode', async () => {
    uiMode.shouldRenderPro = false
    renderPage()
    await screen.findByText('WhatsApp intake analytics')

    expect(screen.getAllByText('Drafts').length).toBeGreaterThan(0)
    expect(screen.getByText('Approval rate')).toBeInTheDocument()
    expect(screen.queryByText('Average approval time')).not.toBeInTheDocument()
    expect(screen.queryByText('Estimated AI cost')).not.toBeInTheDocument()
  })

  it('applies the selected reporting period', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() =>
      expect(apiMock.getWhatsAppListingsAgentAnalytics).toHaveBeenCalledWith('30d'),
    )

    await user.click(screen.getByRole('button', { name: '7 days' }))

    await waitFor(() =>
      expect(apiMock.getWhatsAppListingsAgentAnalytics).toHaveBeenLastCalledWith('7d'),
    )
  })

  it('renders an actionable empty state', async () => {
    apiMock.getWhatsAppListingsAgentAnalytics.mockResolvedValue({
      ...DATA,
      summary: { ...DATA.summary, total_drafts: 0, approved: 0, approval_rate: 0 },
      field_accuracy: [],
    })
    renderPage()

    expect(await screen.findByText('No intake activity in this period')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open intake inbox' })).toHaveAttribute(
      'href',
      '/agent/whatsapp-listings',
    )
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
  })

  it('shows an error and retries the request', async () => {
    const user = userEvent.setup()
    apiMock.getWhatsAppListingsAgentAnalytics
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(DATA)
    renderPage()

    expect(await screen.findByText('Analytics are unavailable')).toBeInTheDocument()
    expect(screen.getByText('network unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Field accuracy')).toBeInTheDocument()
  })

  it('exports the selected analytics as CSV', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Field accuracy')
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:analytics')
    expect(await screen.findByText('Analytics exported')).toBeInTheDocument()
  })

  it('uses RTL-aware navigation and remains a single-column mobile shell', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    renderPage({ dir: 'rtl' })
    await screen.findByText('WhatsApp intake analytics')

    const backLink = screen.getByRole('link', { name: /Intake inbox/i })
    expect(backLink.querySelector('svg')).toHaveClass('rtl:rotate-180')
    expect(screen.getByTestId('whatsapp-intake-analytics')).not.toHaveClass('overflow-x-auto')
    expect(screen.getByRole('group', { name: 'Reporting period' })).toBeInTheDocument()
  })
})

describe('analytics helpers', () => {
  it('buckets long activity ranges without dropping totals', () => {
    const activity = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      drafts: 1,
      approved: index % 2,
    }))
    const result = bucketActivity(activity, 12)

    expect(result.length).toBeLessThanOrEqual(12)
    expect(result.reduce((sum, item) => sum + item.drafts, 0)).toBe(30)
  })

  it('creates an export with KPIs, field confidence, and daily activity', () => {
    const csv = analyticsCsv(DATA)
    expect(csv).toContain('Approval rate,75%')
    expect(csv).toContain('Title,96%,12')
    expect(csv).toContain('2026-09-18,6,5')
  })
})
