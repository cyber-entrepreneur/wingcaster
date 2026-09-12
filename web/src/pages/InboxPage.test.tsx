// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getConversations: vi.fn(),
  getConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
  markConversationRead: vi.fn(),
  closeConversation: vi.fn(),
  updateConversation: vi.fn(),
  assignConversation: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  API_BASE: '/api',
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'agent_1', name: 'Test Agent' },
    loading: false,
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { InboxPage } from '@/pages/InboxPage'

const legacyConv = {
  id: 'conv_legacy',
  contact_name: 'Ahmed Khoury',
  contact_email: 'a***@example.com',
  contact_phone: '+971 5X *** **34',
  source_channel: 'email_bayut',
  status: 'open',
  last_message_at: '2026-09-08T09:00:00Z',
  last_message_preview: 'Following up on the villa…',
  unread_count: 1,
  is_unread_by_agent: true,
  assigned_agent_id: null,
  priority_score: 40,
}

const modernConv = {
  id: 'conv_modern',
  contact_name: 'Sara Al-Mansoori',
  contact_email: 'sara@example.com',
  contact_phone: '+97150111222',
  channel: 'whatsapp',
  source: 'bayut',
  source_channel: 'whatsapp:bayut',
  status: 'open',
  last_message_at: '2026-09-08T09:12:00Z',
  last_message_preview: 'Is the 2BR still available?',
  unread_count: 2,
  is_unread_by_agent: true,
  assigned_agent_id: 'agent_1',
  priority_score: 87,
  priority_reason: 'hot lead',
}

function renderInbox(path = '/inbox') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/inbox/:conversationId" element={<InboxPage />} />
        <Route path="/dashboard/inbox" element={<InboxPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('InboxPage AGT-INB-001/002', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getConversations.mockResolvedValue([legacyConv, modernConv])
    apiMocks.getConversation.mockImplementation(async (id: string) => {
      const base = id === 'conv_legacy' ? legacyConv : modernConv
      return {
        ...base,
        messages: [
          {
            id: 'm1',
            direction: 'inbound',
            channel: readChannelSafe(base),
            content: base.last_message_preview,
            status: 'received',
            created_at: '2026-09-08T08:12:00Z',
          },
          {
            id: 'm2',
            direction: 'outbound',
            channel: readChannelSafe(base),
            content: 'Yes, still available.',
            status: 'read',
            created_at: '2026-09-08T08:14:00Z',
          },
        ],
        contact: { name: base.contact_name, email: base.contact_email, phone: base.contact_phone },
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('lists conversations with dual-read channel+source for legacy and modern rows', async () => {
    renderInbox()
    await waitFor(() => {
      expect(screen.getByText('Sara Al-Mansoori')).toBeInTheDocument()
    })
    expect(screen.getByText('Ahmed Khoury')).toBeInTheDocument()
    // Unread sub-line numerals
    expect(screen.getAllByText(/unread/i).length).toBeGreaterThan(0)
  })

  it('opens conversation detail with dual badges and compose bar', async () => {
    renderInbox()
    await waitFor(() => screen.getByText('Sara Al-Mansoori'))
    fireEvent.click(screen.getByRole('button', { name: /Sara Al-Mansoori/i }))
    await waitFor(() => {
      expect(screen.getByText('Is the 2BR still available?')).toBeInTheDocument()
    })
    expect(screen.getAllByLabelText(/WhatsApp from Bayut/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Compose message')).toBeInTheDocument()
    expect(screen.getAllByText(/From Bayut/i).length).toBeGreaterThan(0)
  })

  it('dual-reads legacy source_channel in detail header', async () => {
    renderInbox('/inbox/conv_legacy')
    await waitFor(() => {
      expect(screen.getByText('Ahmed Khoury')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getAllByLabelText(/Email from Bayut/i).length).toBeGreaterThan(0)
    })
  })

  it('filters by unread chip', async () => {
    apiMocks.getConversations.mockResolvedValue([
      { ...modernConv, unread_count: 0, is_unread_by_agent: false },
      legacyConv,
    ])
    renderInbox()
    await waitFor(() => screen.getByText('Ahmed Khoury'))
    fireEvent.click(screen.getByRole('button', { name: 'Unread' }))
    await waitFor(() => {
      expect(screen.queryByText('Sara Al-Mansoori')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Ahmed Khoury')).toBeInTheDocument()
  })
})

function readChannelSafe(row: { channel?: string; source_channel?: string }) {
  if (row.channel) return row.channel
  if (row.source_channel?.startsWith('email')) return 'email'
  if (row.source_channel?.startsWith('whatsapp')) return 'whatsapp'
  return 'direct'
}
