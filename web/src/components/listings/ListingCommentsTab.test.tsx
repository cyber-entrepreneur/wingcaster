// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ListingCommentsTab } from './ListingCommentsTab'

const mockGetListingComments = vi.fn()
const mockReclassifyComment = vi.fn()
const mockSendConversationMessage = vi.fn()
const mockAddToast = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    getListingComments: (...args: unknown[]) => mockGetListingComments(...args),
    reclassifyComment: (...args: unknown[]) => mockReclassifyComment(...args),
    sendConversationMessage: (...args: unknown[]) => mockSendConversationMessage(...args),
  },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}))

const sampleResponse = {
  threads: [
    {
      conversation_id: 'conv-1',
      platform: 'facebook',
      channel: 'facebook_comment',
      external_post_id: 'post-1',
      distribution_url: 'https://facebook.com/post/1',
      top_category: 'question',
      contact: { id: 'c-1', name: 'Jane Buyer', avatar: null },
      needs_agent_attention: false,
      messages: [
        {
          id: 'msg-1',
          direction: 'inbound' as const,
          content: 'Is this still available?',
          created_at: '2026-03-01T10:00:00Z',
          author_name: 'Jane Buyer',
          status: 'received',
          category: 'question',
          sentiment: 'neutral' as const,
          category_confidence: 0.9,
          category_source: 'ai' as const,
          suggested_reply: null,
          suggested_reply_composed_at: null,
          needs_agent_attention: false,
          priority: 'normal' as const,
          is_hidden: false,
          routings: [],
        },
      ],
      last_activity_at: '2026-03-01T10:00:00Z',
    },
  ],
  published_posts: 1,
  summary: { question: 1 },
  category_meta: {
    question: { label: 'Question', emoji: '❓', description: 'Buyer question', route: 'reply' },
    spam: { label: 'Spam', emoji: '🚫', description: 'Spam', route: 'hide' },
  },
}

describe('ListingCommentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetListingComments.mockResolvedValue(sampleResponse)
  })

  function renderTab(listingId = 'lst-1') {
    return render(
      <MemoryRouter>
        <ListingCommentsTab listingId={listingId} />
      </MemoryRouter>,
    )
  }

  it('renders AGT-LST-012 screen marker and comment threads', async () => {
    renderTab()

    await waitFor(() => {
      expect(screen.getByText('Is this still available?')).toBeInTheDocument()
    })

    expect(document.querySelector('[data-screen="AGT-LST-012"]')).toBeTruthy()
    expect(screen.getByText('Jane Buyer')).toBeInTheDocument()
    expect(screen.getByText('Comments on your published posts')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark spam' })).toBeInTheDocument()
  })

  it('shows empty state when no comment threads', async () => {
    mockGetListingComments.mockResolvedValue({
      threads: [],
      published_posts: 0,
      summary: {},
      category_meta: {},
    })
    renderTab()

    await waitFor(() => {
      expect(screen.getByText(/No comments yet/)).toBeInTheDocument()
    })
  })
})
