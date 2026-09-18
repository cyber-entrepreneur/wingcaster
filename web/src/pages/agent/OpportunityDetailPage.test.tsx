// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { OpportunityDetailPage } from './OpportunityDetailPage'

const apiMock = vi.hoisted(() => ({
  getOpportunity: vi.fn(),
  getContact: vi.fn(),
  updateOpportunity: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => {} }))

function opp(over = {}) {
  return {
    id: 'op-1',
    contact_id: 'c-1',
    property_id: 'p-1',
    stage: 'qualification',
    deal_value: 500000,
    currency: 'USD',
    probability: 40,
    expected_close_date: '2026-10-01',
    lost_reason: '',
    closed_at: null,
    notes: 'keen buyer',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    stage_history: [{ stage: 'new', changed_at: '2026-09-01T00:00:00Z' }],
    ...over,
  }
}

function renderAt(id = 'op-1') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/opportunities/${id}`]}>
        <Routes>
          <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  apiMock.getOpportunity.mockReset().mockResolvedValue(opp())
  apiMock.getContact.mockReset().mockResolvedValue({ name: 'Jane Buyer' })
  apiMock.updateOpportunity.mockReset()
})
afterEach(() => cleanup())

describe('OpportunityDetailPage (AGT-OPP-002)', () => {
  it('loads and shows the deal, contact, stage, and history', async () => {
    renderAt()
    expect(await screen.findByTestId('opportunity-detail-page')).toBeInTheDocument()
    expect(screen.getAllByText('Jane Buyer').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('500000')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Stage history/i })).toBeInTheDocument()
  })

  it('saves an edited stage + value via PATCH', async () => {
    const user = userEvent.setup()
    apiMock.updateOpportunity.mockResolvedValue(opp({ stage: 'offer', deal_value: 520000 }))
    renderAt()
    await screen.findByTestId('opportunity-detail-page')

    await user.selectOptions(screen.getByLabelText('Stage'), 'offer')
    await user.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() =>
      expect(apiMock.updateOpportunity).toHaveBeenCalledWith(
        'op-1',
        expect.objectContaining({ stage: 'offer', deal_value: 500000 }),
      ),
    )
  })

  it('shows a not-found state on 404', async () => {
    apiMock.getOpportunity.mockRejectedValue(Object.assign(new Error('nope'), { status: 404 }))
    renderAt('ghost')
    expect(await screen.findByText(/doesn’t exist or you don’t have access/i)).toBeInTheDocument()
  })
})
