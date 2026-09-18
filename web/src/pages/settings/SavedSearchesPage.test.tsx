// @vitest-environment jsdom
/**
 * Page-level coverage for SavedSearchesPage (AGT-CMP-005).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getSavedSearches: vi.fn(),
  createSavedSearchWithAlerts: vi.fn(),
  updateSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
  runSavedSearchAlerts: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { SavedSearchesPage } from './SavedSearchesPage'

const SAMPLE = {
  id: 'ss-1',
  user_id: 'agent-1',
  name: 'Beirut buyers',
  filters: { type: 'sale', city: 'Beirut' },
  alert_enabled: true,
  alert_channel: 'inapp' as const,
  alert_frequency: 'daily' as const,
  last_alert_run_at: '2026-09-18T00:00:00.000Z',
  last_match_count: 3,
  created_at: '2026-09-18T00:00:00.000Z',
  updated_at: '2026-09-18T00:00:00.000Z',
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <SavedSearchesPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.getSavedSearches.mockResolvedValue([])
  window.confirm = vi.fn(() => true)
})

afterEach(() => {
  cleanup()
})

describe('SavedSearchesPage', () => {
  it('renders empty state when the user has no saved searches', async () => {
    renderPage()
    expect(await screen.findByText(/No saved searches yet/i)).toBeInTheDocument()
    expect(apiMock.getSavedSearches).toHaveBeenCalled()
  })

  it('creates a saved search from the add dialog', async () => {
    const user = userEvent.setup()
    apiMock.createSavedSearchWithAlerts.mockResolvedValue(SAMPLE)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Add search/i }))
    await user.type(screen.getByLabelText(/^Name$/i), 'Beirut buyers')
    await user.selectOptions(screen.getByLabelText(/Listing type/i), 'sale')
    await user.type(screen.getByLabelText(/^City$/i), 'Beirut')
    await user.click(screen.getByRole('button', { name: /Create search/i }))

    await waitFor(() =>
      expect(apiMock.createSavedSearchWithAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Beirut buyers',
          filters: expect.objectContaining({ type: 'sale', city: 'Beirut' }),
        }),
      ),
    )
    expect(await screen.findByText('Beirut buyers')).toBeInTheDocument()
  })

  it('toggles alert_enabled on an existing row', async () => {
    const user = userEvent.setup()
    apiMock.getSavedSearches.mockResolvedValue([SAMPLE])
    apiMock.updateSavedSearch.mockResolvedValue({ ...SAMPLE, alert_enabled: false })
    renderPage()

    await user.click(await screen.findByTitle('Disable alerts'))
    await waitFor(() =>
      expect(apiMock.updateSavedSearch).toHaveBeenCalledWith('ss-1', { alert_enabled: false }),
    )
  })

  it('runs alerts for all searches', async () => {
    const user = userEvent.setup()
    apiMock.getSavedSearches.mockResolvedValue([SAMPLE])
    apiMock.runSavedSearchAlerts.mockResolvedValue({
      searches_processed: 1,
      total_matches: 3,
      results: [],
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Run now/i }))
    await waitFor(() => expect(apiMock.runSavedSearchAlerts).toHaveBeenCalled())
  })
})
