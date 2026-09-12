// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { makeState } from './testState'
import type { OnboardingState } from '@/components/onboarding/useOnboardingState'

const navigateMock = vi.hoisted(() => vi.fn())
const hook = vi.hoisted(() => ({
  state: null as unknown as OnboardingState,
  isLoading: false,
  isError: false,
  patch: vi.fn(async (body: Record<string, unknown>) => body),
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

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('./onboardingApi', () => ({
  trackOnboardingEvent: vi.fn(),
}))

import { OnboardingChecklistWidget } from './OnboardingChecklistWidget'

function renderWidget(props?: { variant?: 'card' | 'pill'; state?: OnboardingState }) {
  return render(
    <MemoryRouter>
      <OnboardingChecklistWidget {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  hook.state = makeState({
    checklist: {
      welcome_seen: true,
      first_listing_drafted: true,
      first_listing_published: true,
      channels_connected: false,
      notifications_enabled: false,
      profile_completed: false,
      subscription_active: false,
    },
  }) as OnboardingState
  hook.isLoading = false
  hook.isError = false
  hook.patch.mockResolvedValue({})
})

describe('OnboardingChecklistWidget (AGT-ONB-005)', () => {
  it('renders the full card with ring math 1/4 and hides completed by default', () => {
    renderWidget()
    expect(screen.getByRole('region', { name: /Onboarding progress/i })).toBeInTheDocument()
    expect(screen.getByText('Finish setting up')).toBeInTheDocument()
    expect(screen.getByText(/You're 25% there — 3 steps left/i)).toBeInTheDocument()
    expect(screen.getByText('Connect a publishing channel')).toBeInTheDocument()
    expect(screen.getByText('Upgrade to paid')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show completed \(1\)/i })).toBeInTheDocument()
    expect(screen.queryByText('Publish your first listing')).not.toBeInTheDocument()
    expect(document.querySelector('[data-signal-lamp]')).toBeNull()
  })

  it('shows Completed via {source} on completed rows', async () => {
    const user = userEvent.setup()
    const state = makeState({
      checklist: {
        welcome_seen: true,
        first_listing_drafted: true,
        first_listing_published: true,
        channels_connected: false,
        notifications_enabled: false,
        profile_completed: false,
        subscription_active: false,
      },
    })
    ;(state as typeof state & { checklist_sources: Record<string, string> }).checklist_sources = {
      first_listing_published: 'whatsapp_intake',
    }
    renderWidget({ state })
    await user.click(screen.getByRole('button', { name: /Show completed/i }))
    expect(screen.getByText('Completed via WhatsApp intake')).toBeInTheDocument()
  })

  it('does not render when dismissed forever', () => {
    hook.state = makeState({ dismissed_forever: true })
    const { container } = renderWidget()
    expect(container).toBeEmptyDOMElement()
  })

  it('hides entirely when the hook errors', () => {
    hook.isError = true
    const { container } = renderWidget()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a skeleton while loading', () => {
    hook.isLoading = true
    renderWidget()
    expect(document.querySelector('[data-onboarding-checklist-skeleton]')).toBeTruthy()
  })

  it('renders the Pro pill variant instead of the card', () => {
    renderWidget({ variant: 'pill' })
    expect(document.querySelector('[data-onboarding-pill]')).toBeTruthy()
    expect(screen.queryByText('Finish setting up')).not.toBeInTheDocument()
  })

  it('opens the dismiss confirm dialog and PATCHes', async () => {
    const user = userEvent.setup()
    renderWidget()
    await user.click(screen.getByRole('button', { name: /Dismiss this checklist/i }))
    expect(screen.getByText('Dismiss this checklist?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Yes, dismiss/i }))
    await waitFor(() =>
      expect(hook.patch).toHaveBeenCalledWith({ dismissed_forever: true }),
    )
  })
})
