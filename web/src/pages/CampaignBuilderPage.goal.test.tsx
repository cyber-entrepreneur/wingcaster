// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CampaignBuilderPage } from './CampaignBuilderPage'

vi.mock('@/api/client', () => ({
  api: {
    getMessageTemplates: vi.fn().mockResolvedValue([]),
    createJourney: vi.fn(),
  },
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
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

afterEach(() => cleanup())

describe('CampaignBuilderPage goal presets (AGT-CMP-001)', () => {
  it('prefills the wizard from ?goal=open_house', async () => {
    render(
      <MemoryRouter initialEntries={['/journeys/new?goal=open_house']}>
        <Routes>
          <Route path="/journeys/new" element={<CampaignBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByDisplayValue('Open house invitations')).toBeInTheDocument(),
    )
    expect(
      screen.getByDisplayValue(/Drive RSVPs for an open house/),
    ).toBeInTheDocument()
  })

  it('starts blank when no goal is supplied', async () => {
    render(
      <MemoryRouter initialEntries={['/journeys/new']}>
        <Routes>
          <Route path="/journeys/new" element={<CampaignBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(/New lead nurture/),
      ).toHaveValue(''),
    )
  })
})
