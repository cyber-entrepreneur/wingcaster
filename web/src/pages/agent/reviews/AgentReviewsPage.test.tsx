// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedAgentReview, ManagedAgentReviewsResponse } from '@/api/client'

const mocks = vi.hoisted(() => ({
  getReviews: vi.fn(),
  respond: vi.fn(),
  flag: vi.fn(),
}))

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getMyAgentReviews: mocks.getReviews,
      respondToAgentReview: mocks.respond,
      flagAgentReview: mocks.flag,
    },
  }
})

import { AgentReviewsPage } from './AgentReviewsPage'

const firstReview: ManagedAgentReview = {
  id: 'review-1',
  rating: 5,
  title: 'Professional from start to finish',
  comment: 'Clear communication throughout.',
  reviewer: { name: 'Samira Client' },
  verified_transaction: true,
  status: 'published',
  response: null,
  responded_at: null,
  flag: { status: 'none', reason: null, details: null, flagged_at: null },
  created_at: '2026-09-18T12:00:00.000Z',
  updated_at: '2026-09-18T12:00:00.000Z',
}

const secondReview: ManagedAgentReview = {
  ...firstReview,
  id: 'review-2',
  rating: 3,
  title: null,
  comment: 'The follow-up was slower than expected.',
  reviewer: { name: 'Omar Client' },
  verified_transaction: false,
  response: 'Thank you for sharing this.',
  responded_at: '2026-09-18T13:00:00.000Z',
  flag: {
    status: 'pending',
    reason: 'false_claim',
    details: 'Timeline differs from CRM history.',
    flagged_at: '2026-09-18T13:00:00.000Z',
  },
}

function fixture(reviews = [firstReview, secondReview]): ManagedAgentReviewsResponse {
  return {
    summary: {
      total: reviews.length,
      average: reviews.length === 2 ? 4 : reviews[0]?.rating || 0,
      distribution: { 1: 0, 2: 0, 3: reviews.includes(secondReview) ? 1 : 0, 4: 0, 5: reviews.includes(firstReview) ? 1 : 0 },
      awaiting_response: reviews.filter((review) => !review.response).length,
      flagged: reviews.filter((review) => review.flag.status === 'pending').length,
    },
    reviews,
  }
}

function renderPage(direction: 'ltr' | 'rtl' = 'ltr') {
  return render(
    <div dir={direction}>
      <MemoryRouter>
        <AgentReviewsPage />
      </MemoryRouter>
    </div>,
  )
}

describe('AgentReviewsPage', () => {
  beforeEach(() => {
    mocks.getReviews.mockReset().mockResolvedValue(fixture())
    mocks.respond.mockReset()
    mocks.flag.mockReset()
  })

  it('renders summary, distribution, and review details in RTL', async () => {
    renderPage('rtl')

    expect(screen.getByRole('status')).toHaveTextContent('Loading reviews')
    expect(await screen.findByRole('heading', { name: 'Reviews received' })).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Review summary' })
    expect(within(summary).getByText('4.0')).toHaveAttribute('data-lc-numeric')
    expect(screen.getByText('Samira Client')).toBeInTheDocument()
    expect(screen.getByText('Verified transaction')).toBeInTheDocument()
    expect(screen.getByText('Flag under review')).toBeInTheDocument()
  })

  it('filters to reviews that need a response', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Reviews received' })

    fireEvent.click(screen.getByRole('button', { name: 'Needs response' }))

    expect(screen.getByText('Samira Client')).toBeInTheDocument()
    expect(screen.queryByText('Omar Client')).not.toBeInTheDocument()
  })

  it('publishes an inline response and updates the card', async () => {
    const updated = {
      ...firstReview,
      response: 'Thank you for trusting me.',
      responded_at: '2026-09-18T14:00:00.000Z',
    }
    mocks.respond.mockResolvedValue(updated)
    mocks.getReviews.mockResolvedValue(fixture([firstReview]))
    renderPage()
    await screen.findByText('Samira Client')

    fireEvent.click(screen.getByRole('button', { name: 'Respond' }))
    fireEvent.change(screen.getByLabelText('Public response'), {
      target: { value: 'Thank you for trusting me.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish response' }))

    await waitFor(() => expect(mocks.respond).toHaveBeenCalledWith(
      'review-1',
      'Thank you for trusting me.',
    ))
    expect(await screen.findByText('Thank you for trusting me.')).toBeInTheDocument()
  })

  it('submits a moderation flag with details', async () => {
    const updated = {
      ...firstReview,
      flag: {
        status: 'pending' as const,
        reason: 'privacy' as const,
        details: 'Contains a private address.',
        flagged_at: '2026-09-18T14:00:00.000Z',
      },
    }
    mocks.flag.mockResolvedValue(updated)
    mocks.getReviews.mockResolvedValue(fixture([firstReview]))
    renderPage()
    await screen.findByText('Samira Client')

    fireEvent.click(screen.getByRole('button', { name: 'Flag inappropriate' }))
    fireEvent.change(screen.getByLabelText('Why should this review be checked?'), {
      target: { value: 'privacy' },
    })
    fireEvent.change(screen.getByLabelText('Supporting details (optional)'), {
      target: { value: 'Contains a private address.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit flag' }))

    await waitFor(() => expect(mocks.flag).toHaveBeenCalledWith('review-1', {
      reason: 'privacy',
      details: 'Contains a private address.',
    }))
    expect(await screen.findByText('Flag under review')).toBeInTheDocument()
  })

  it('renders the no-reviews empty state', async () => {
    mocks.getReviews.mockResolvedValue(fixture([]))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'No reviews yet' })).toBeInTheDocument()
  })

  it('shows a retryable load error', async () => {
    mocks.getReviews.mockRejectedValueOnce(new Error('Network unavailable'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    mocks.getReviews.mockResolvedValueOnce(fixture([firstReview]))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Samira Client')).toBeInTheDocument()
    expect(mocks.getReviews).toHaveBeenCalledTimes(2)
  })
})
