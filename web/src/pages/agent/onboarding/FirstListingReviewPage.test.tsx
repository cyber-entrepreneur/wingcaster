// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { makeState } from './testState'
import type { OnboardingState } from '@/components/onboarding/useOnboardingState'

const navigateMock = vi.hoisted(() => vi.fn())
const hook = vi.hoisted(() => ({
  state: null as unknown as OnboardingState,
  isLoading: false,
  isError: false,
  patch: vi.fn(async (body: Record<string, unknown>) => body),
}))

const apiMocks = vi.hoisted(() => ({
  getWhatsAppDraft: vi.fn(),
  approveWhatsAppDraft: vi.fn(),
  discardWhatsAppDraft: vi.fn(),
  trackOnboardingEvent: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/hooks/useOnboardingState', () => ({
  useOnboardingState: () => ({
    state: hook.state,
    data: hook.state,
    patch: hook.patch,
    isLoading: hook.isLoading,
    isError: hook.isError,
    mutate: async () => hook.state,
    error: undefined,
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'u1', name: 'Sara' }, loading: false }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => <button type="button" aria-label="Colour mode">mode</button>,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('./onboardingApi', () => apiMocks)

import { FirstListingReviewPage } from './FirstListingReviewPage'

const SAMPLE = {
  id: 'draft_1',
  status: 'awaiting_approval',
  title: '2BR · Downtown Dubai',
  price: 2_400_000,
  currency: 'AED',
  beds: 2,
  baths: 2,
  areaLabel: '1,200 sqft',
  address: 'Downtown Dubai, Burj Vista Tower 1',
  description: 'Bright 2-bedroom apartment on the 32nd floor with Burj Khalifa view.',
  photo_urls: ['/p1.jpg', '/p2.jpg', '/p3.jpg', '/p4.jpg'],
  property_id: 'prop_1',
}

function renderPage(draftId = 'draft_1') {
  return render(
    <MemoryRouter initialEntries={[`/onboarding/first-listing/${draftId}`]}>
      <Routes>
        <Route path="/onboarding/first-listing/:draftId" element={<FirstListingReviewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  hook.state = makeState({ step: 'draft_review', path: 'whatsapp' }) as OnboardingState
  hook.patch.mockResolvedValue({})
  apiMocks.getWhatsAppDraft.mockResolvedValue(SAMPLE)
  apiMocks.approveWhatsAppDraft.mockResolvedValue({ success: true, result: { property_id: 'prop_1' } })
  apiMocks.discardWhatsAppDraft.mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, onLine: true })
})

describe('FirstListingReviewPage (AGT-ONB-003)', () => {
  it('renders the loaded draft and publish CTA', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: /We drafted your first listing from your voice memo/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Drafted by WingCaster AI from your voice memo/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Publish my first listing/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Open full editor/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Discard and start over/i }).length).toBeGreaterThan(0)
    expect(screen.queryByTestId('signal-lamp')).not.toBeInTheDocument()
  })

  it('shows the publishing overlay then routes to celebration', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/Downtown Dubai, Burj Vista Tower 1/i)
    await user.click(screen.getAllByRole('button', { name: /Publish my first listing/i })[0])
    expect(document.querySelector('[data-publishing-overlay]')).toBeTruthy()
    await waitFor(() =>
      expect(apiMocks.approveWhatsAppDraft).toHaveBeenCalledWith('draft_1'),
    )
    expect(hook.patch).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'first_published' }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/first-listing/published')
  })

  it('opens a confirm dialog before discard', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Downtown Dubai, Burj Vista Tower 1')
    await user.click(screen.getAllByRole('button', { name: /Discard and start over/i })[0])
    expect(screen.getByText('Discard this draft?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Yes, discard/i }))
    await waitFor(() => expect(apiMocks.discardWhatsAppDraft).toHaveBeenCalledWith('draft_1'))
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/welcome')
  })

  it('redirects collecting drafts back to WhatsApp intake', async () => {
    apiMocks.getWhatsAppDraft.mockResolvedValue({ ...SAMPLE, status: 'collecting' })
    renderPage()
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/onboarding/whatsapp', { replace: true }),
    )
  })

  it('redirects 404 drafts to welcome', async () => {
    const err = Object.assign(new Error('missing'), { status: 404 })
    apiMocks.getWhatsAppDraft.mockRejectedValue(err)
    renderPage()
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/onboarding/welcome', { replace: true }),
    )
  })

  it('shows load-failed recovery', async () => {
    apiMocks.getWhatsAppDraft.mockRejectedValue(Object.assign(new Error('nope'), { status: 500 }))
    renderPage()
    expect(await screen.findByText(/couldn't load your draft/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
  })
})
