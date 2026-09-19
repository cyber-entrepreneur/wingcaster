// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { AgentPublicProfileEditorPage } from './AgentPublicProfileEditorPage'

const authMocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  refreshAgent: vi.fn(),
  agent: {
    id: 'agent-1',
    name: 'Sara Agent',
    slug: 'sara-agent',
    bio: 'Experienced broker',
    specialization: 'Villas',
    languages: 'English, Arabic',
    photo: 'https://cdn.example/photo.jpg',
    cta_config: { public_profile: { show_reviews: false } },
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: authMocks.agent,
    updateProfile: authMocks.updateProfile,
    refreshAgent: authMocks.refreshAgent,
  }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/components/layout/CrmShell', () => ({
  CrmShell: ({ children }: { children: React.ReactNode }) => <div data-testid="crm-shell">{children}</div>,
}))

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/agent/profile']}>
        <Routes>
          <Route path="/agent/profile" element={<AgentPublicProfileEditorPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  authMocks.updateProfile.mockReset().mockResolvedValue(undefined)
  authMocks.refreshAgent.mockReset().mockResolvedValue(undefined)
})

afterEach(() => cleanup())

describe('AgentPublicProfileEditorPage (AGT-APP-001)', () => {
  it('renders profile fields from the signed-in agent', async () => {
    renderPage()
    expect(await screen.findByTestId('agent-public-profile-editor')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Experienced broker')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Villas')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Show reviews/i })).not.toBeChecked()
  })

  it('saves edits via updateProfile', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('agent-public-profile-editor')
    await user.clear(screen.getByLabelText('Bio'))
    await user.type(screen.getByLabelText('Bio'), 'Updated bio')
    await user.click(screen.getByRole('button', { name: /^Save$/i }))
    await waitFor(() =>
      expect(authMocks.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          bio: 'Updated bio',
          cta_config: expect.objectContaining({
            public_profile: expect.objectContaining({ show_reviews: false }),
          }),
        }),
      ),
    )
    expect(authMocks.refreshAgent).toHaveBeenCalled()
  })

  it('links preview to the public portfolio route', async () => {
    renderPage()
    await screen.findByTestId('agent-public-profile-editor')
    const preview = screen.getByRole('link', { name: /Preview/i })
    expect(preview).toHaveAttribute('href', '/public/agent/sara-agent')
    expect(preview).toHaveAttribute('target', '_blank')
  })
})
