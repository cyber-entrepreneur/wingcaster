// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { CampaignBuilderPage } from './CampaignBuilderPage'

const apiMock = vi.hoisted(() => ({
  getMessageTemplates: vi.fn(),
  getSavedSearches: vi.fn(),
  createCampaign: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'agent-1' } }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => {} }))

function renderWizard(goal?: string) {
  const path = goal ? `/campaigns/new?goal=${goal}` : '/campaigns/new'
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/campaigns/new" element={<CampaignBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  apiMock.getMessageTemplates.mockReset().mockResolvedValue([])
  apiMock.getSavedSearches.mockReset().mockResolvedValue([
    { id: 'search-abc12345', name: 'Marina buyers' },
  ])
  apiMock.createCampaign.mockReset().mockResolvedValue({ id: 'camp-1' })
})
afterEach(() => cleanup())

describe('CampaignBuilderPage (AGT-CMP-002)', () => {
  it('renders the guided wizard with matrix screen marker', async () => {
    renderWizard()
    expect(await screen.findByText('Choose a goal')).toBeInTheDocument()
    expect(document.querySelector('[data-screen="AGT-CMP-002"]')).toBeTruthy()
    expect(screen.getByText('Goal')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
  })

  it('seeds the goal step from ?goal= query param', async () => {
    renderWizard('price_drop')
    expect(await screen.findByDisplayValue('Price drop alert')).toBeInTheDocument()
  })

  it('walks through audience saved-search and creates a draft campaign', async () => {
    const user = userEvent.setup()
    renderWizard('price_drop')
    await screen.findByDisplayValue('Price drop alert')

    await user.click(screen.getByRole('button', { name: /Continue/i }))

    await user.click(screen.getByRole('button', { name: /Saved search/i }))
    await user.selectOptions(screen.getByRole('combobox'), 'search-abc12345')
    await user.click(screen.getByRole('button', { name: /Continue/i }))

    await user.click(screen.getByRole('button', { name: /Continue/i }))

    await user.click(screen.getByRole('button', { name: /Continue/i }))

    await user.click(screen.getByRole('button', { name: /Schedule for later/i }))
    await user.type(screen.getByLabelText('Launch date'), '2026-10-15')
    await user.click(screen.getByRole('button', { name: /Continue/i }))

    await user.click(screen.getByRole('button', { name: /Launch campaign/i }))

    await waitFor(() =>
      expect(apiMock.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Price drop alert',
          status: 'draft',
          tags_filter: expect.arrayContaining(['saved_search:search-abc12345', 'price-sensitive']),
        }),
      ),
    )
  })
})
