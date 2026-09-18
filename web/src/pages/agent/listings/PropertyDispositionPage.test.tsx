// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropertyDispositionResponse } from '@/api/client'

const mocks = vi.hoisted(() => ({
  getCase: vi.fn(),
  updateDecision: vi.fn(),
  resolveCase: vi.fn(),
}))

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    api: {
      getPropertyDispositionCase: mocks.getCase,
      updatePropertyDispositionDecision: mocks.updateDecision,
      resolvePropertyDispositionCase: mocks.resolveCase,
    },
  }
})

import { PropertyDispositionPage } from './PropertyDispositionPage'

function fixture(overrides: Partial<PropertyDispositionResponse['case']> = {}): PropertyDispositionResponse {
  return {
    case: {
      id: 'case-1',
      property_id: 'prop-1',
      proposed_disposition: 'agency_retains',
      agency_proposed_disposition: null,
      agent_proposed_disposition: null,
      agency_notes: null,
      agent_notes: null,
      status: 'pending',
      initiated_by: 'admin-1',
      resolved_by: null,
      resolution_notes: null,
      created_at: '2026-09-18T10:00:00.000Z',
      updated_at: '2026-09-18T10:00:00.000Z',
      resolved_at: null,
      ...overrides,
    },
    property: {
      id: 'prop-1',
      title: 'Marina apartment',
      reference: 'WC-100',
      status: 'active',
      price: 850000,
      price_unit: 'USD',
      city: 'Dubai',
      neighborhood: 'Marina',
      photo: null,
    },
    parties: { agency: 'Compass Realty', agent: 'Rania Agent' },
    viewer_role: 'agent',
    can_resolve: overrides.status === 'agreed',
  }
}

function renderPage(direction: 'ltr' | 'rtl' = 'ltr') {
  return render(
    <div dir={direction}>
      <MemoryRouter initialEntries={['/listings/prop-1/disposition']}>
        <Routes>
          <Route path="/listings/:id/disposition" element={<PropertyDispositionPage />} />
          <Route path="/listings/:id" element={<div>Listing detail</div>} />
        </Routes>
      </MemoryRouter>
    </div>,
  )
}

describe('PropertyDispositionPage', () => {
  beforeEach(() => {
    mocks.getCase.mockReset().mockResolvedValue(fixture())
    mocks.updateDecision.mockReset()
    mocks.resolveCase.mockReset()
  })

  it('renders the two-party pending state and listing summary', async () => {
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading disposition case')
    expect(await screen.findByRole('heading', { name: 'Property disposition case' })).toBeInTheDocument()
    expect(screen.getByText('Compass Realty and Rania Agent must agree')).toBeInTheDocument()
    expect(screen.getByText('WC-100')).toHaveAttribute('data-lc-numeric')
    expect(screen.getByText('Awaiting decisions')).toBeInTheDocument()
    expect(screen.getByText('Waiting for their decision')).toBeInTheDocument()
  })

  it('saves the current party decision and notes', async () => {
    const updated = fixture({
      agent_proposed_disposition: 'agent_retains',
      agent_notes: 'I brought this mandate.',
    })
    mocks.updateDecision.mockResolvedValue(updated)
    renderPage()
    await screen.findByRole('heading', { name: 'Property disposition case' })

    fireEvent.click(screen.getByLabelText(/Agent retains/))
    fireEvent.change(screen.getByLabelText('Notes for the other party'), {
      target: { value: 'I brought this mandate.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save my decision' }))

    await waitFor(() => expect(mocks.updateDecision).toHaveBeenCalledWith('prop-1', {
      disposition: 'agent_retains',
      notes: 'I brought this mandate.',
    }))
  })

  it('renders the disputed state in RTL without changing workflow order', async () => {
    mocks.getCase.mockResolvedValue(fixture({
      status: 'disputed',
      agent_proposed_disposition: 'agent_retains',
      agency_proposed_disposition: 'agency_retains',
      agency_notes: 'The agency funded the campaign.',
    }))
    renderPage('rtl')

    expect(await screen.findByText('Needs alignment')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('recommendations do not match')
    expect(screen.getByText('The agency funded the campaign.')).toBeInTheDocument()
    expect(screen.getByText('Case initiated')).toBeInTheDocument()
  })

  it('resolves a matched agreement', async () => {
    const agreed = fixture({
      status: 'agreed',
      agent_proposed_disposition: 'agency_retains',
      agency_proposed_disposition: 'agency_retains',
    })
    const completed = fixture({
      status: 'completed',
      agent_proposed_disposition: 'agency_retains',
      agency_proposed_disposition: 'agency_retains',
      resolved_by: 'user-agent',
      resolved_at: '2026-09-18T12:00:00.000Z',
    })
    mocks.getCase.mockResolvedValue(agreed)
    mocks.resolveCase.mockResolvedValue(completed)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Resolve case' }))

    await waitFor(() => expect(mocks.resolveCase).toHaveBeenCalledWith('prop-1'))
    expect(await screen.findByText('Resolved as')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
  })

  it('renders a calm empty state for a leak-safe 404', async () => {
    mocks.getCase.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'No active disposition case' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to listing' })).toHaveAttribute('href', '/listings/prop-1')
  })

  it('shows an error state and keeps the decision form usable', async () => {
    mocks.getCase.mockResolvedValue(fixture())
    mocks.updateDecision.mockRejectedValue(new Error('Network unavailable'))
    renderPage()
    await screen.findByRole('heading', { name: 'Property disposition case' })

    fireEvent.click(screen.getByLabelText(/Archive listing/))
    fireEvent.click(screen.getByRole('button', { name: 'Save my decision' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(screen.getByRole('button', { name: 'Save my decision' })).toBeEnabled()
  })
})
