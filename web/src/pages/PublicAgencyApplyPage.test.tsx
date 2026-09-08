// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicAgencyApplyPage } from '@/pages/PublicAgencyApplyPage'

const apiMock = vi.hoisted(() => ({
  getAgencyPublic: vi.fn(),
  resolveInvitation: vi.fn(),
  applyToAgencyBySlug: vi.fn(),
  acceptInvitation: vi.fn(),
}))

const authMock = vi.hoisted(() => ({
  agent: null as null | { id: string; name: string; email: string; photo?: string; agency_name?: string },
  loading: false,
  register: vi.fn(),
  logout: vi.fn(),
  refreshAgent: vi.fn(),
}))

const addToast = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  api: apiMock,
  API_BASE: '/api',
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agencies/:agencySlug/apply" element={<PublicAgencyApplyPage />} />
        <Route path="/join/:invitationCode" element={<PublicAgencyApplyPage />} />
        <Route path="/agencies" element={<div>Browse agencies</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicAgencyApplyPage', () => {
  beforeEach(() => {
    authMock.agent = null
    authMock.loading = false
    addToast.mockClear()
    apiMock.getAgencyPublic.mockReset()
    apiMock.resolveInvitation.mockReset()
    apiMock.applyToAgencyBySlug.mockReset()
    apiMock.acceptInvitation.mockReset()
    authMock.register.mockReset()
    authMock.refreshAgent.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads slug agency and shows not-accepting empty state', async () => {
    apiMock.getAgencyPublic.mockResolvedValue({
      id: 'a1',
      name: 'Elite Real Estate',
      slug: 'elite-real-estate',
      description: 'Premium residential',
      accepting_applications: false,
      member_count: 24,
      listings_count: 312,
      city: 'UAE',
    })

    renderAt('/agencies/elite-real-estate/apply?ref=bazaar')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/isn't accepting/)
    })
    expect(apiMock.getAgencyPublic).toHaveBeenCalledWith('elite-real-estate')
  })

  it('signed-in flow submits via applyToAgencyBySlug', async () => {
    const user = userEvent.setup()
    authMock.agent = {
      id: 'u1',
      name: 'Sara Almansoori',
      email: 'sara@example.com',
      agency_name: '',
    }
    apiMock.getAgencyPublic.mockResolvedValue({
      id: 'a1',
      name: 'Elite Real Estate',
      slug: 'elite-real-estate',
      description: 'Premium residential',
      accepting_applications: true,
      member_count: 24,
      listings_count: 10,
      city: 'UAE',
    })
    apiMock.applyToAgencyBySlug.mockResolvedValue({
      application: {
        id: 'app-001122',
        agency_id: 'a1',
        agency_name: 'Elite Real Estate',
        status: 'pending',
      },
      redirect_to: '/applications/app-001122',
    })

    renderAt('/agencies/elite-real-estate/apply?ref=bazaar')

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Apply to join Elite Real Estate/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('region', { name: /agency you are applying to/i })).toBeInTheDocument()

    await user.type(
      screen.getByLabelText(/Message to the agency/i),
      'I have been selling in Dubai Marina for 3 years.',
    )
    await user.click(screen.getByText('Immediately'))
    const boxes = screen.getAllByRole('checkbox')
    await user.click(boxes[0]!)
    await user.click(boxes[1]!)
    await user.click(screen.getByRole('button', { name: /Submit application/i }))

    await waitFor(() => {
      expect(apiMock.applyToAgencyBySlug).toHaveBeenCalled()
    })
    expect(apiMock.applyToAgencyBySlug.mock.calls[0]![0]).toBe('elite-real-estate')
    expect(apiMock.applyToAgencyBySlug.mock.calls[0]![1]).toEqual(
      expect.objectContaining({
        availability: 'immediately',
        referral_source: 'bazaar',
        consents: { terms: true, profile_share: true },
      }),
    )

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Application sent/)
    })
  })

  it('invitation expired shows empty state with apply-directly CTA', async () => {
    apiMock.resolveInvitation.mockResolvedValue({
      code: 'abc',
      status: 'expired',
      expires_at: '2026-09-01T00:00:00Z',
      single_use: true,
      agency: {
        id: 'a1',
        name: 'Elite Real Estate',
        slug: 'elite-real-estate',
        description: null,
        logo: null,
      },
    })

    renderAt('/join/abc')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invitation has expired/i)
    })
    expect(screen.getByRole('link', { name: /Apply directly to Elite Real Estate/i })).toHaveAttribute(
      'href',
      '/agencies/elite-real-estate/apply',
    )
  })
})
