// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { WhatsAppAuditLogPage } from './WhatsAppAuditLogPage'

const apiMock = vi.hoisted(() => ({
  getAdminWhatsAppListingsAuditLog: vi.fn(),
  adminWhatsAppListingsAuditLogCsvPath: vi.fn(() => '/api/admin/whatsapp-listings/audit-log.csv'),
}))
vi.mock('@/api/client', () => ({
  api: apiMock,
  getAuthToken: () => 'test-token',
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <WhatsAppAuditLogPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.getAdminWhatsAppListingsAuditLog.mockResolvedValue({
    total: 1,
    offset: 0,
    limit: 50,
    items: [
      {
        id: 'log-1',
        at: '2026-09-18T12:00:00.000Z',
        tenant: 'agent-abc',
        event: 'draft_created',
        reference: 'draft-9',
        actor: 'pa-user-1',
      },
    ],
  })
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['timestamp,tenant\n']),
  }) as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WhatsAppAuditLogPage (PA-WLA-004)', () => {
  it('loads and renders audit rows', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /WhatsApp audit log/i })).toBeInTheDocument()
    expect(await screen.findByText('draft_created')).toBeInTheDocument()
    expect(screen.getByText('agent-abc')).toBeInTheDocument()
    expect(screen.getByText('draft-9')).toBeInTheDocument()
  })

  it('applies agent and action filters', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('draft_created')
    await user.type(screen.getByLabelText(/Agent ID/i), 'agent-abc')
    await user.type(screen.getByLabelText(/^Event/i), 'draft_created')
    await user.click(screen.getByRole('button', { name: /Apply filters/i }))
    await waitFor(() =>
      expect(apiMock.getAdminWhatsAppListingsAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ agent_id: 'agent-abc', action: 'draft_created', offset: '0' }),
      ),
    )
  })

  it('exports csv using the auth proxy path', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('draft_created')
    await user.click(screen.getByRole('button', { name: /Export CSV/i }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(apiMock.adminWhatsAppListingsAuditLogCsvPath).toHaveBeenCalled()
  })
})
