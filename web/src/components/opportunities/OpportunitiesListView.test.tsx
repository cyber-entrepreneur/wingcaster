// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { OpportunitiesListView } from './OpportunitiesListView'

const SAMPLE = {
  id: 'opp-1',
  contact_id: 'c-1',
  property_id: null,
  stage: 'qualification',
  deal_value: 250000,
  currency: 'USD',
  probability: 40,
  expected_close_date: '2026-10-01T00:00:00.000Z',
  notes: '',
}

describe('OpportunitiesListView', () => {
  it('renders empty state', () => {
    render(
      <MemoryRouter>
        <OpportunitiesListView
          opportunities={[]}
          loading={false}
          stageFilter="open"
          onStageFilterChange={vi.fn()}
          contactName={() => 'Unknown'}
          onAdvance={vi.fn()}
          onRetreat={vi.fn()}
          onAdd={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/No deals yet/i)).toBeInTheDocument()
  })

  it('advances stage from row actions', async () => {
    const user = userEvent.setup()
    const onAdvance = vi.fn()
    render(
      <MemoryRouter>
        <OpportunitiesListView
          opportunities={[SAMPLE]}
          loading={false}
          stageFilter="open"
          onStageFilterChange={vi.fn()}
          contactName={() => 'Alex Buyer'}
          onAdvance={onAdvance}
          onRetreat={vi.fn()}
          onAdd={vi.fn()}
        />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /^Advance$/i }))
    expect(onAdvance).toHaveBeenCalledWith(SAMPLE)
  })
})
