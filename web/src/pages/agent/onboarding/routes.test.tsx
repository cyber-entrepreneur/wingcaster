// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'

vi.mock('@/hooks/useOnboardingState', () => ({
  useOnboardingState: () => ({
    state: {
      user_id: 'u',
      step: 'first_published',
      path: 'whatsapp',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      dismissed_forever: false,
      checklist: {
        welcome_seen: true,
        first_listing_drafted: true,
        first_listing_published: true,
        channels_connected: false,
        notifications_enabled: false,
        profile_completed: false,
        subscription_active: false,
      },
    },
    patch: vi.fn(async () => ({})),
    isLoading: false,
    isError: false,
    mutate: vi.fn(),
    data: {},
    error: undefined,
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { name: 'Sara' }, loading: false }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div>Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => <button type="button">mode</button>,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('./onboardingApi', () => ({
  getPublishedListing: vi.fn(async () => ({
    id: 'prop_1',
    priceLabel: 'AED 2.4M',
    address: 'Burj Vista Tower 1',
  })),
  getWhatsAppDraft: vi.fn(async () => ({
    id: 'draft_1',
    status: 'awaiting_approval',
    title: 'Draft',
  })),
  trackOnboardingEvent: vi.fn(),
  postActivationCode: vi.fn(async () => ({
    display_code: 'WC-A7K3',
    shared_number_e164: '+97145550199',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  })),
  getBindingStatus: vi.fn(async () => ({ bound: false })),
  listWhatsAppDrafts: vi.fn(async () => []),
}))

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,stub') },
}))

import { onboardingRoutes } from './routes'

describe('onboardingRoutes', () => {
  it('registers /onboarding/first-listing/published before :draftId', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/first-listing/published']}>
        <Routes>{onboardingRoutes}</Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: /Your first listing is live/i })).toBeInTheDocument()
  })
})
