// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { VendorDetailPage } from './VendorDetailPage'
import type { VendorDetail, VendorMarginResponse, VendorRatesResponse, VendorStatementsResponse } from './vendorTypes'

expect.extend(toHaveNoViolations)

const vendor: VendorDetail = {
  id: '00000000-0000-0000-0000-000000000123',
  environment: 'LIVE',
  name: 'OpenAI',
  currency: 'USD',
  active: true,
  mtd_units: 2_500_000,
  mtd_cost_micro_usd: 12_500_000,
  active_rate_versions: 1,
  products: [{ id: 'product-1', product_code: 'ai.tokens', product_class: 'AI' }],
  rateCards: [{ id: 'card-1', name: 'Standard API rates' }],
  rate_schedule: [],
  mtd_statement: null,
}

const rates: VendorRatesResponse = {
  rates: [
    {
      id: 'rate-1',
      rate_card_id: 'card-1',
      rate_card_name: 'Standard API rates',
      version_n: 2,
      effective_from: '2026-09-01T00:00:00Z',
      effective_to: null,
      status: 'ACTIVE',
      rates: { 'ai.tokens': { unit_cost_minor: 5_000, currency: 'USD' } },
    },
  ],
  next_cursor: null,
  total_estimate: 1,
}

const statements: VendorStatementsResponse = {
  statements: [
    {
      id: 'statement-1',
      statement_period_key: '2026-09',
      currency: 'USD',
      subtotal_minor: 12_000,
      tax_minor: 600,
      total_minor: 12_600,
      status: 'RECEIVED',
      unresolved_variance_count: 2,
    },
  ],
  next_cursor: null,
  total_estimate: 1,
}

const margin: VendorMarginResponse = {
  vendor_id: vendor.id,
  month: '2026-09',
  features: [
    {
      feature: 'ai.tokens',
      units: 2_500_000,
      selling_micro_usd: 20_000_000,
      cost_micro_usd: 12_500_000,
      selling_unit_rate_minor: 8_000,
      margin_pct: 37.5,
    },
  ],
}

const apiMock = vi.hoisted(() => ({
  getAdminVendor: vi.fn(),
  listAdminVendorRates: vi.fn(),
  listAdminVendorStatements: vi.fn(),
  getAdminVendorMargin: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }))

function renderPage(dir: 'ltr' | 'rtl' = 'ltr') {
  return render(
    <div dir={dir}>
      <MemoryRouter initialEntries={[`/admin/fin/vendors/${vendor.id}`]}>
        <Routes>
          <Route path="/admin/fin/vendors/:id" element={<VendorDetailPage />} />
        </Routes>
      </MemoryRouter>
    </div>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-18T12:00:00Z'))
  apiMock.getAdminVendor.mockResolvedValue(vendor)
  apiMock.listAdminVendorRates.mockResolvedValue(rates)
  apiMock.listAdminVendorStatements.mockResolvedValue(statements)
  apiMock.getAdminVendorMargin.mockResolvedValue(margin)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('VendorDetailPage (PA-VEN-002)', () => {
  it('renders vendor summary and active rate schedules', async () => {
    renderPage()

    expect(await screen.findByText('OpenAI')).toBeTruthy()
    expect(screen.getByText('ai.tokens')).toBeTruthy()
    expect(screen.getByText('$12.50')).toBeTruthy()
    expect(document.querySelectorAll('[data-lc-numeric]').length).toBeGreaterThan(0)
  })

  it('shows monthly statements and server-computed margin', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await screen.findByText('OpenAI')

    await user.click(screen.getByRole('tab', { name: /Statements/ }))
    expect(screen.getByText('2026-09')).toBeTruthy()
    expect(screen.getByText('$126.00')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Margin' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('37.5% margin')).toBeTruthy()
    expect(within(panel).getByText('$20.00')).toBeTruthy()
  })

  it('surfaces a leak-safe not-found state', async () => {
    apiMock.getAdminVendor.mockRejectedValueOnce(Object.assign(new Error('missing'), { status: 404 }))
    renderPage()

    expect(await screen.findByText('Vendor not found')).toBeTruthy()
    expect(screen.getByText(/selected environment/i)).toBeTruthy()
  })

  it('recovers from load failure', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    apiMock.getAdminVendor.mockRejectedValueOnce(new Error('offline'))
    renderPage()

    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('OpenAI')).toBeTruthy()
    expect(apiMock.getAdminVendor).toHaveBeenCalledTimes(2)
  })

  it('has no accessibility violations in RTL', async () => {
    const { container } = renderPage('rtl')
    await screen.findByText('OpenAI')
    expect(await axe(container)).toHaveNoViolations()
  })
})
