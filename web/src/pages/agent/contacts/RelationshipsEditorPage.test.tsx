// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type {
  ContactRelationship,
  RedactedRelationship,
} from './relationshipTypes'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getContact: vi.fn(),
  getContactRelationshipsMine: vi.fn(),
  getContactRelationshipsOther: vi.fn(),
  createContactRelationship: vi.fn(),
  updateContactRelationship: vi.fn(),
  deleteContactRelationship: vi.fn(),
  resendRelationshipConsentLink: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'usr_1', name: 'Agent' },
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  API_BASE: '/api',
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { RelationshipsEditorPage } from './RelationshipsEditorPage'

function mineRel(overrides: Partial<ContactRelationship> = {}): ContactRelationship {
  return {
    id: 'rel_1',
    tenant_id: 'personal:usr_1',
    contact_id: 'cnt_1',
    agent_user_id: 'usr_1',
    party_type: 'buyer',
    relationship_type: 'representation',
    exclusivity: 'exclusive',
    scope: {
      areas: ['dubai-marina'],
      property_types: ['apartment'],
      price_range: { currency: 'AED', min: 1200000, max: 2400000 },
    },
    status: 'pending',
    consent_record: {},
    starts_at: '2026-09-08T00:00:00.000Z',
    ends_at: '2027-03-08T00:00:00.000Z',
    created_at: '2026-09-05T10:00:00.000Z',
    updated_at: '2026-09-05T10:00:00.000Z',
    ...overrides,
  }
}

function redacted(overrides: Partial<RedactedRelationship> = {}): RedactedRelationship {
  return {
    id: 'redacted',
    relationship_type: 'representation',
    party_type: 'buyer',
    exclusivity: 'exclusive',
    status: 'active',
    starts_month: '2026-06',
    ends_month: '2027-06',
    scope_summary: { areas_region: 'Dubai', property_types: ['apartment'] },
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/contacts/cnt_1/relationships']}>
      <Routes>
        <Route path="/contacts/:contactId/relationships" element={<RelationshipsEditorPage />} />
        <Route path="/contacts/:id" element={<div>Contact detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RelationshipsEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    apiMocks.getContact.mockResolvedValue({
      id: 'cnt_1',
      name: 'Sara Al-Mansoori',
      email: 'sara@example.com',
      phone: '+971500000000',
    })
    apiMocks.getContactRelationshipsMine.mockResolvedValue({ relationships: [mineRel()] })
    apiMocks.getContactRelationshipsOther.mockResolvedValue({
      relationships: [redacted()],
      disabled: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders mine + redacted other sections without inventing PII', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Relationships' })).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: /My relationships/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Other agencies representing this contact/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Waiting on Sara Al-Mansoori to confirm via link/i)).toBeInTheDocument()
    expect(screen.getByText(/Agent \+ agency: hidden per contact privacy/i)).toBeInTheDocument()
    expect(screen.getByText(/Price range redacted/i)).toBeInTheDocument()
    expect(screen.queryByText(/Elite Real Estate/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/agent@other/i)).not.toBeInTheDocument()
  })

  it('shows cross-tenant disabled copy when other list is gated', async () => {
    apiMocks.getContactRelationshipsOther.mockRejectedValue(
      Object.assign(new Error('disabled'), {
        status: 403,
        error: 'CROSS_TENANT_VISIBILITY_DISABLED',
        message: 'This contact has disabled cross-agency awareness.',
      }),
    )
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText(/This contact has disabled cross-agency awareness/i),
      ).toBeInTheDocument()
    })
  })

  it('only exposes edit/resend/cancel on pending cards', async () => {
    apiMocks.getContactRelationshipsMine.mockResolvedValue({
      relationships: [
        mineRel({ id: 'rel_pending', status: 'pending' }),
        mineRel({
          id: 'rel_active',
          status: 'active',
          consent_record: { method: 'email_reply', summary: 'Confirmed' },
        }),
      ],
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Resend confirmation/i)).toBeInTheDocument()
    })
    expect(screen.getAllByRole('button', { name: /Resend confirmation/i })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /Cancel request/i })).toHaveLength(1)
    // Active card has no pending footer actions
    const articles = screen.getAllByRole('article')
    expect(articles.length).toBeGreaterThanOrEqual(2)
    const active = articles.find((el) => within(el).queryByText(/^Active$/i))
    expect(active).toBeTruthy()
    expect(within(active!).queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument()
  })

  it('creates a pending relationship and toasts', async () => {
    const user = userEvent.setup()
    apiMocks.getContactRelationshipsMine.mockResolvedValue({ relationships: [] })
    apiMocks.getContactRelationshipsOther.mockResolvedValue({ relationships: [], disabled: false })
    apiMocks.createContactRelationship.mockResolvedValue(mineRel())
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Add first relationship/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /\+ Add first relationship/i }))
    await user.click(screen.getByRole('radio', { name: /Representation/i }))
    await user.click(screen.getByRole('button', { name: /Continue/i }))
    await user.click(screen.getByRole('radio', { name: /^Buyer$/i }))
    await user.click(screen.getByRole('button', { name: /Continue/i }))
    await user.click(screen.getByRole('button', { name: /Save relationship/i }))
    await waitFor(() => {
      expect(apiMocks.createContactRelationship).toHaveBeenCalledWith(
        'cnt_1',
        expect.objectContaining({
          party_type: 'buyer',
          relationship_type: 'representation',
        }),
      )
    })
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Awaiting confirmation/i),
      }),
    )
  })

  it('resends consent link for pending relationships', async () => {
    const user = userEvent.setup()
    apiMocks.resendRelationshipConsentLink.mockResolvedValue({
      sent_at: '2026-09-08T14:22:00Z',
      expires_at: '2026-09-15T14:22:00Z',
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resend confirmation/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Resend confirmation/i }))
    await waitFor(() => {
      expect(apiMocks.resendRelationshipConsentLink).toHaveBeenCalledWith('cnt_1', 'rel_1')
    })
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Confirmation link resent.' }),
    )
  })

  it('cancels pending via delete', async () => {
    const user = userEvent.setup()
    apiMocks.deleteContactRelationship.mockResolvedValue(null)
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel request/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Cancel request/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Cancel this pending relationship/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /^Cancel request$/i }))
    await waitFor(() => {
      expect(apiMocks.deleteContactRelationship).toHaveBeenCalledWith('cnt_1', 'rel_1')
    })
  })
})
