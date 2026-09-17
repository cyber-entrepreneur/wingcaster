// @vitest-environment jsdom
/**
 * Page-level coverage for AuditLogPage (H5).
 *
 * Covers: empty state, filter compose → search API call, next-page pagination,
 * CSV export uses Authorization header (fetched-then-blob'd, not bare <a>),
 * server errors surface via toast.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  searchAuditLog: vi.fn(),
  auditLogCsvPath: vi.fn((filters: Record<string, unknown>) => `/api/audit/log.csv?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')  as [string, string][])}`),
}))
vi.mock('@/api/client', async () => ({
  api: apiMock,
  getAuthToken: () => 'test-token',
  API_BASE: '/api',
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

// jsdom lacks URL.createObjectURL / fetch — stub for the CSV path.
Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: () => 'blob://mock',
})
Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: () => undefined,
})

import { AuditLogPage } from './AuditLogPage'

const ROW = {
  id: 'a-1',
  agent_id: 'user-1',
  agency_id: 'agency-a',
  type: 'agency_mfa_policy_updated',
  action: 'update',
  entity_type: 'agency_mfa_policy',
  entity_id: 'agency-a',
  ip: '1.2.3.4',
  user_agent: 'Mozilla/5.0',
  metadata: {},
  created_at: '2026-09-16T10:00:00Z',
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/admin/audit']}>
        <AuditLogPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.searchAuditLog.mockResolvedValue({
    entries: [],
    pagination: { limit: 25, offset: 0, total: 0 },
  })
})

afterEach(() => {
  cleanup()
})

describe('AuditLogPage', () => {
  it('renders empty state when no entries match', async () => {
    renderPage()
    await waitFor(() => expect(apiMock.searchAuditLog).toHaveBeenCalled())
    expect(await screen.findByText(/No audit entries match/i)).toBeInTheDocument()
  })

  it('applies filters on Search and re-issues query', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(apiMock.searchAuditLog).toHaveBeenCalled())

    await user.type(screen.getByLabelText(/^Type$/i), 'agency_mfa_policy_updated')
    await user.type(screen.getByLabelText(/Free text/i), 'passkey')
    await user.click(screen.getByRole('button', { name: /^Search$/i }))

    await waitFor(() =>
      expect(apiMock.searchAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'agency_mfa_policy_updated',
          q: 'passkey',
          limit: 25,
          offset: 0,
        }),
      ),
    )
  })

  it('paginates via Next / Previous', async () => {
    const user = userEvent.setup()
    apiMock.searchAuditLog.mockResolvedValue({
      entries: [ROW, { ...ROW, id: 'a-2' }],
      pagination: { limit: 25, offset: 0, total: 60 },
    })
    renderPage()
    // Wait for the table body to render (both rows have the type; use All).
    await waitFor(() => expect(screen.getAllByText(/agency_mfa_policy_updated/).length).toBeGreaterThan(0))
    await user.click(screen.getByRole('button', { name: /^Next$/i }))
    await waitFor(() =>
      expect(apiMock.searchAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 25 }),
      ),
    )
  })

  it('CSV export fetches with Authorization header (not bare <a href>)', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['id,type\n'])),
    })
    vi.stubGlobal('fetch', fetchSpy)

    renderPage()
    await waitFor(() => expect(apiMock.searchAuditLog).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: /Export CSV/i }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [, opts] = fetchSpy.mock.calls[0]
    expect((opts as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer test-token')
  })

  it('surfaces server error via toast', async () => {
    apiMock.searchAuditLog.mockRejectedValueOnce(new Error('db offline'))
    renderPage()
    expect(await screen.findByText(/Could not load audit log/i)).toBeInTheDocument()
  })

  it('Previous button disabled at offset 0', async () => {
    apiMock.searchAuditLog.mockResolvedValue({
      entries: [ROW],
      pagination: { limit: 25, offset: 0, total: 60 },
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText(/agency_mfa_policy_updated/).length).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: /^Previous$/i })).toBeDisabled()
  })
})
