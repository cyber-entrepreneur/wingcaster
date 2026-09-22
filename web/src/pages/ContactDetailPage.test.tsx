// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Radix Tabs / menus need these in jsdom.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

const addToast = vi.hoisted(() => vi.fn())
const authValue = vi.hoisted(() => ({ agent: { id: 'agent-1' } }))
const apiMocks = vi.hoisted(() => ({
  getContact: vi.fn(),
  getContactTimeline: vi.fn(),
  getContactNotes: vi.fn(),
  getTasks: vi.fn(),
  getOpportunities: vi.fn(),
  getContactAttachments: vi.fn(),
  getContacts: vi.fn(),
  completeTask: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authValue }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => {} }))
vi.mock('@/api/client', () => ({ api: apiMocks, getAuthToken: () => 'tok' }))
// Stub heavy children so the test targets the card layout itself.
vi.mock('@/components/contact-360/Contact360Panel', () => ({ Contact360Panel: () => <div data-testid="c360" /> }))
vi.mock('@/components/contacts/MergeContactsDialog', () => ({
  MergeContactsDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="merge-open" /> : null),
}))
vi.mock('@/components/contacts/QuickTaskDialog', () => ({
  QuickTaskDialog: ({ open, defaultType }: { open: boolean; defaultType?: string }) =>
    (open ? <div data-testid="task-open" data-type={defaultType} /> : null),
}))
vi.mock('@/components/opportunities/AddOpportunityDialog', () => ({
  AddOpportunityDialog: ({ open, initialContact }: { open: boolean; initialContact?: { id: string } | null }) =>
    (open ? <div data-testid="deal-open" data-contact={initialContact?.id} /> : null),
}))

import { ContactDetailPage } from '@/pages/ContactDetailPage'

const PAST = new Date(Date.now() - 86400000).toISOString()
const FUTURE = new Date(Date.now() + 86400000).toISOString()

beforeEach(() => {
  addToast.mockReset()
  apiMocks.getContact.mockReset().mockResolvedValue({
    id: 'c1', name: 'Ada Lovelace', email: 'ada@x.com', phone: '+111', status: 'client',
    source: 'referral', tags: ['vip'], first_touch_channel: 'referral', first_touch_at: PAST,
    last_activity_at: PAST, created_at: PAST, contact_role: 'buyer', organization_name: 'Analytical Engines',
    socials: { whatsapp: '+222' },
  })
  apiMocks.getContactTimeline.mockReset().mockResolvedValue({ events: [] })
  apiMocks.getContactNotes.mockReset().mockResolvedValue([])
  apiMocks.getTasks.mockReset().mockResolvedValue({ items: [
    { id: 't-open', contact_id: 'c1', title: 'Overdue call', status: 'pending', due_at: PAST, type: 'call' },
    { id: 't-up', contact_id: 'c1', title: 'Future meeting', status: 'pending', due_at: FUTURE, type: 'meeting' },
    { id: 't-done', contact_id: 'c1', title: 'Signed papers', status: 'completed', due_at: PAST, type: 'follow_up' },
  ] })
  apiMocks.getOpportunities.mockReset().mockResolvedValue([
    { id: 'd-open', contact_id: 'c1', stage: 'negotiation', probability: 60, deal_value: 500000, currency: 'USD', expected_close_date: null },
    { id: 'd-won', contact_id: 'c1', stage: 'closed_won', probability: 100, deal_value: 600000, currency: 'USD', expected_close_date: null },
  ])
  apiMocks.getContactAttachments.mockReset().mockResolvedValue({ attachments: [
    { id: 'a1', kind: 'pre_approval_letter', filename: 'letter.pdf', content_type: 'application/pdf', size_bytes: 10 },
  ] })
  apiMocks.getContacts.mockReset().mockResolvedValue([])
})
afterEach(() => vi.restoreAllMocks())

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/contacts/c1']}>
      <Routes>
        <Route path="/contacts/:id" element={<ContactDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ContactDetailPage card', () => {
  it('renders the header, role/org, and quick-action bar', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Analytical Engines · Source: referral')).toBeInTheDocument()
    // Primary deep-link from the quick-action bar.
    expect(screen.getByRole('link', { name: /Email/ })).toHaveAttribute('href', 'mailto:ada@x.com')
  })

  it('groups tasks into open / upcoming / closed', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Ada Lovelace', level: 1 })
    await user.click(screen.getByRole('tab', { name: /Actions/ }))
    expect(await screen.findByText('Overdue call')).toBeInTheDocument()
    expect(screen.getByText('Future meeting')).toBeInTheDocument()
    expect(screen.getByText('Signed papers')).toBeInTheDocument()
    expect(screen.getByText(/Open \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Upcoming \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Closed \(1\)/)).toBeInTheDocument()
  })

  it('groups deals into open and closed', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Ada Lovelace', level: 1 })
    await user.click(screen.getByRole('tab', { name: /Deals/ }))
    expect(await screen.findByText(/Open deals \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Closed deals \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('negotiation')).toBeInTheDocument()
    expect(screen.getByText('closed won')).toBeInTheDocument()
  })

  it('lists attachments with a download control', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Ada Lovelace', level: 1 })
    await user.click(screen.getByRole('tab', { name: /Attachments/ }))
    expect(await screen.findByText('letter.pdf')).toBeInTheDocument()
    expect(screen.getByText('Pre-approval letter')).toBeInTheDocument()
  })

  it('opens the meeting and deal dialogs from the quick-action bar', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Ada Lovelace', level: 1 })
    fireEvent.click(screen.getByRole('button', { name: /^Meeting$/ }))
    expect(await screen.findByTestId('task-open')).toHaveAttribute('data-type', 'meeting')
    fireEvent.click(screen.getByRole('button', { name: /New deal/ }))
    expect(await screen.findByTestId('deal-open')).toHaveAttribute('data-contact', 'c1')
  })
})
