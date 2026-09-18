// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { BuyerOffer } from '@/api/client'
import { OffersComparisonChart } from './OffersComparisonChart'

function offer(over: Partial<BuyerOffer> = {}): BuyerOffer {
  return {
    id: Math.random().toString(36).slice(2),
    property_id: 'p1',
    agent_id: 'a1',
    contact_id: null,
    offeror_name: 'Buyer',
    amount: 100000,
    currency: 'USD',
    offer_date: '2026-09-18',
    terms: null,
    financing_type: null,
    expiry_date: null,
    conditions: null,
    status: 'received',
    notes: null,
    created_at: '2026-09-18T00:00:00Z',
    updated_at: '2026-09-18T00:00:00Z',
    ...over,
  }
}

afterEach(() => cleanup())

describe('OffersComparisonChart', () => {
  it('renders nothing when there are no priced offers', () => {
    const { container } = render(<OffersComparisonChart offers={[]} currency="USD" />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders a bar per priced offer, sorted high-to-low', () => {
    const offers = [
      offer({ offeror_name: 'Low', amount: 400000 }),
      offer({ offeror_name: 'High', amount: 500000 }),
    ]
    const { container } = render(<OffersComparisonChart offers={offers} currency="USD" />)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBe(2)
    // First-rendered bar is the highest amount (sorted desc)
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent)
    const highIdx = labels.findIndex((l) => l === 'High')
    const lowIdx = labels.findIndex((l) => l === 'Low')
    expect(highIdx).toBeLessThan(lowIdx)
  })

  it('draws reference lines with labels for the prices provided', () => {
    const { container, getByText } = render(
      <OffersComparisonChart
        offers={[offer({ amount: 480000 })]}
        currency="USD"
        asking={500000}
        benchmark={475000}
        avgAsking={510000}
      />,
    )
    // 3 reference lines + the baseline = at least 4 <line> elements
    expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(4)
    expect(getByText(/Asking ·/)).toBeInTheDocument()
    expect(getByText(/Benchmark \(sold\) ·/)).toBeInTheDocument()
    expect(getByText(/Avg asking ·/)).toBeInTheDocument()
  })

  it('flags the leading live offer', () => {
    const offers = [
      offer({ offeror_name: 'Rejected high', amount: 600000, status: 'rejected' }),
      offer({ offeror_name: 'Live top', amount: 500000, status: 'countered' }),
    ]
    const { getByText } = render(<OffersComparisonChart offers={offers} currency="USD" />)
    // Leading = highest-amount LIVE offer, even though a rejected offer is higher
    expect(getByText(/· Leading/)).toBeInTheDocument()
  })

  it('caps at 8 bars and notes the overflow', () => {
    const offers = Array.from({ length: 10 }, (_, i) => offer({ amount: 100000 + i * 1000 }))
    const { container, getByText } = render(<OffersComparisonChart offers={offers} currency="USD" />)
    expect(container.querySelectorAll('rect').length).toBe(8)
    expect(getByText(/Showing the top 8 of 10 offers/)).toBeInTheDocument()
  })
})
