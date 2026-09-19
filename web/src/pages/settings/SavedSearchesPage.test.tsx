// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SavedSearchesPage } from './SavedSearchesPage'

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
}))
vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

const apiMock = vi.hoisted(() => ({
  getSavedSearches: vi.fn(),
  createSavedSearchWithAlerts: vi.fn(),
  updateSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
  runSavedSearchAlerts: vi.fn(),
}))
vi.mock('@/api/client', () => ({
  api: apiMock,
}))

const sampleSearch = {
  id: 'ss-1',
  user_id: 'agent-1',
  agent_id: 'agent-1',
  contact_id: null,
  name: 'Marina buyers',
  filters: { city: 'Dubai', bedrooms: 2 },
  filter_summary: 'Dubai · 2+ beds',
  alert_enabled: true,
  alert_channel: 'inapp' as const,
  alert_frequency: 'daily' as const,
  last_alert_run_at: null,
  last_match_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SavedSearchesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  toastMock.addToast.mockReset()
  apiMock.getSavedSearches.mockReset()
  apiMock.createSavedSearchWithAlerts.mockReset()
  apiMock.updateSavedSearch.mockReset()
  apiMock.deleteSavedSearch.mockReset()
  apiMock.runSavedSearchAlerts.mockReset()
  apiMock.getSavedSearches.mockResolvedValue({ saved_searches: [sampleSearch] })
})

describe('SavedSearchesPage', () => {
  it('renders saved searches list', async () => {
    renderPage()
    await waitFor(() => {
      expect(apiMock.getSavedSearches).toHaveBeenCalled()
      expect(screen.getByText('Marina buyers')).toBeInTheDocument()
    })
    expect(screen.getByText('Dubai · 2+ beds')).toBeInTheDocument()
  })

  it('renders empty state when no searches exist', async () => {
    apiMock.getSavedSearches.mockResolvedValue({ saved_searches: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/No saved searches yet/i)).toBeInTheDocument()
    })
  })
})
