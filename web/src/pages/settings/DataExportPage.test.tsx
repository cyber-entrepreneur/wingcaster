// @vitest-environment jsdom
/**
 * Page-level coverage for DataExportPage (issue #192b).
 *
 * Contracts covered:
 *   - Empty state renders on first mount
 *   - Request kicks off POST, adds row optimistically, disables while in-flight
 *   - Complete row renders Download button + expiry
 *   - Failed row surfaces error via role=alert
 *   - Request disabled while any in-flight row exists (prevents dup requests)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  requestDataExport: vi.fn(),
  listDataExports: vi.fn(),
  getDataExportStatus: vi.fn(),
  dataExportDownloadPath: vi.fn((id: string) => `/api/settings/data-export/${id}/download`),
}))
vi.mock('@/api/client', async () => {
  return {
    api: apiMock,
    getAuthToken: () => 'test-token',
    API_BASE: '/api',
  }
})
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { DataExportPage } from './DataExportPage'

const NOW = '2026-09-16T00:00:00Z'
const FUTURE = new Date(Date.now() + 5 * 86400_000).toISOString()

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <DataExportPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.listDataExports.mockResolvedValue({ exports: [] })
})

afterEach(() => {
  cleanup()
})

describe('DataExportPage', () => {
  it('renders empty state when no exports exist', async () => {
    renderPage()
    expect(await screen.findByText(/have not requested any data exports/i)).toBeInTheDocument()
    expect(apiMock.listDataExports).toHaveBeenCalled()
  })

  it('kicks off an export and adds the row optimistically', async () => {
    const user = userEvent.setup()
    apiMock.requestDataExport.mockResolvedValue({
      export: {
        id: 'exp-1',
        status: 'pending',
        bytes: null,
        sha256: null,
        error: null,
        requested_at: NOW,
        started_at: null,
        completed_at: null,
        expires_at: FUTURE,
      },
    })
    renderPage()
    await screen.findByText(/have not requested any data exports/i)

    await user.click(screen.getByRole('button', { name: /^Request export$/i }))
    await waitFor(() => expect(apiMock.requestDataExport).toHaveBeenCalled())
    // Row appears with "Preparing…"
    expect(await screen.findByText(/Preparing…/i)).toBeInTheDocument()
    // Request button now disabled (hasInFlight = true)
    expect(screen.getByRole('button', { name: /^Request export$/i })).toBeDisabled()
  })

  it('renders Download button when an export is complete + not expired', async () => {
    apiMock.listDataExports.mockResolvedValue({
      exports: [
        {
          id: 'exp-done',
          status: 'complete',
          bytes: 12345,
          sha256: 'a'.repeat(64),
          error: null,
          requested_at: NOW,
          started_at: NOW,
          completed_at: NOW,
          expires_at: FUTURE,
        },
      ],
    })
    renderPage()
    expect(await screen.findByRole('button', { name: /Download export exp-done/i })).toBeInTheDocument()
    expect(screen.getByText(/sha256 a{12}/i)).toBeInTheDocument()
  })

  it('surfaces error via role=alert on a failed export row', async () => {
    apiMock.listDataExports.mockResolvedValue({
      exports: [
        {
          id: 'exp-fail',
          status: 'failed',
          bytes: null,
          sha256: null,
          error: 'db_offline',
          requested_at: NOW,
          started_at: NOW,
          completed_at: NOW,
          expires_at: FUTURE,
        },
      ],
    })
    renderPage()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/db_offline/)
  })

  it('surfaces backend failure on request via toast', async () => {
    const user = userEvent.setup()
    apiMock.requestDataExport.mockRejectedValue(
      Object.assign(new Error('export_in_progress'), { status: 409 }),
    )
    renderPage()
    await screen.findByText(/have not requested any data exports/i)

    await user.click(screen.getByRole('button', { name: /^Request export$/i }))
    expect(await screen.findByText(/Could not start data export/i)).toBeInTheDocument()
  })
})
