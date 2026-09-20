// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CampaignBuilderPage } from './CampaignBuilderPage'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getMessageTemplates: vi.fn(),
  createJourney: vi.fn(),
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
    agent: { id: 'agt_1', name: 'Sara' },
    loading: false,
    isAdmin: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

function renderAt(path = '/journeys/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/journeys/new" element={<CampaignBuilderPage />} />
        <Route path="/journeys/:id/edit" element={<CampaignBuilderPage />} />
        <Route path="/journeys" element={<div>Journeys list</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMocks.getMessageTemplates.mockReset().mockResolvedValue([])
  apiMocks.createJourney.mockReset().mockResolvedValue({ id: 'jrn_1' })
  addToast.mockReset()
})

afterEach(() => cleanup())

describe('CampaignBuilderPage (AGT-CMP-003)', () => {
  it('renders guided wizard by default', () => {
    renderAt('/journeys/new')
    expect(screen.getByText('Journey basics')).toBeInTheDocument()
    expect(screen.queryByTestId('campaign-builder-pro')).not.toBeInTheDocument()
  })

  it('renders Pro single-page layout when mode=pro', () => {
    renderAt('/journeys/new?mode=pro')
    expect(screen.getByTestId('campaign-builder-pro')).toBeInTheDocument()
    expect(screen.getByText('Goal & audience')).toBeInTheDocument()
    expect(screen.getByText('Channels & schedule')).toBeInTheDocument()
    expect(screen.getByTestId('campaign-pro-preview')).toBeInTheDocument()
  })

  it('saves draft from Pro builder', async () => {
    const user = userEvent.setup()
    renderAt('/journeys/new?mode=pro')

    await user.type(screen.getByPlaceholderText(/New lead nurture/), 'Pro nurture journey')
    await user.type(screen.getByPlaceholderText(/Write your message/), 'Hello {{client_name}}')

    const saveBtn = screen.getByTestId('campaign-pro-save-draft')
    await waitFor(() => expect(saveBtn).not.toBeDisabled())
    await user.click(saveBtn)

    await waitFor(() => {
      expect(apiMocks.createJourney).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Pro nurture journey',
          status: 'draft',
        }),
      )
    })
    expect(await screen.findByText('Journeys list')).toBeInTheDocument()
  })
})
