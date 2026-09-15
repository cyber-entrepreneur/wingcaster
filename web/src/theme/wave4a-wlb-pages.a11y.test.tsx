// @vitest-environment jsdom
/**
 * Page-level axe + WLB-004 live-region checks against the real
 * `feat/wave-4a-wlb` screens (merged into this branch). Primitive-level
 * coverage stays in wave4a-screens.a11y.test.tsx / fixtures.
 *
 * Polls and the fetch-backed hook are mocked so axe stays deterministic.
 */
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { STREAMING_FIELDS, sampleOnboardingState } from '@/theme/wave4a-fixtures'
import type { DraftField } from '@/components/onboarding/whatsapp'

expect.extend(toHaveNoViolations)

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,qr') },
}))

vi.mock('@/pages/agent/whatsapp-intake/useOnboardingState', () => ({
  useOnboardingState: () => ({
    state: sampleOnboardingState(),
    data: sampleOnboardingState(),
    patch: vi.fn(async (s: unknown) => s),
    isLoading: false,
    isError: false,
    error: undefined,
    mutate: vi.fn(async () => sampleOnboardingState()),
    activation: null,
    completeActivation: vi.fn(),
    deferActivation: vi.fn(),
    isStepComplete: () => false,
    completedVia: () => null,
  }),
  markWhatsAppIntakeProgress: vi.fn(async () => undefined),
  completedViaCaption: () => null,
}))

vi.mock('@/pages/agent/whatsapp-intake/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

vi.mock('@/pages/agent/whatsapp-intake/useBindingStatusPoll', () => ({
  useBindingStatusPoll: () => ({
    status: { bound: false },
    bound: false,
    pollError: false,
    capReached: false,
    consecutiveFailures: 0,
  }),
}))

vi.mock('@/pages/agent/whatsapp-intake/useInboundStatusPoll', () => ({
  useInboundStatusPoll: () => ({
    inbound: { bound: true, latest_message_at: null, draft_session_id: null },
    pollError: false,
    capReached: false,
    bindingLost: false,
  }),
}))

vi.mock('@/pages/agent/whatsapp-intake/useDraftProgress', async () => {
  const actual = await vi.importActual<typeof import('@/pages/agent/whatsapp-intake/useDraftProgress')>(
    '@/pages/agent/whatsapp-intake/useDraftProgress',
  )
  return { ...actual, useDraftProgress: vi.fn() }
})

import { useDraftProgress } from '@/pages/agent/whatsapp-intake/useDraftProgress'
import { WhatsAppConnectPage } from '@/pages/agent/whatsapp-intake/WhatsAppConnectPage'
import { ActivationCodePage } from '@/pages/agent/whatsapp-intake/ActivationCodePage'
import { FirstMessageWaitingPage } from '@/pages/agent/whatsapp-intake/FirstMessageWaitingPage'
import { ListingDraftingPage } from '@/pages/agent/whatsapp-intake/ListingDraftingPage'

const useDraftProgressMock = vi.mocked(useDraftProgress)

function progress(over: Partial<ReturnType<typeof useDraftProgress>> = {}) {
  return {
    fields: STREAMING_FIELDS as DraftField[],
    connection: 'sse' as const,
    transport: 'sse' as const,
    isReady: false,
    isConnecting: false,
    error: null,
    draftId: 'draft-1',
    completedCount: 3,
    totalCount: 7,
    ...over,
  }
}

function wrap(ui: ReactElement, path: string, state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <BrandProvider>
        <ToastProvider>
          <main>
            <Routes>
              <Route path="/onboarding/whatsapp/connect" element={ui} />
              <Route path="/onboarding/whatsapp/code" element={ui} />
              <Route path="/onboarding/whatsapp/waiting" element={ui} />
              <Route path="/onboarding/whatsapp/drafting/:sessionId" element={ui} />
            </Routes>
          </main>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  useDraftProgressMock.mockReturnValue(progress())
})

afterEach(() => {
  cleanup()
})

describe('Wave 4A a11y — real WLB pages (feat/wave-4a-wlb)', () => {
  it('WLB-001 WhatsAppConnectPage has no axe violations', async () => {
    const { container } = wrap(<WhatsAppConnectPage />, '/onboarding/whatsapp/connect')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('WLB-002 ActivationCodePage has no axe violations and labelled copy control', async () => {
    const { container } = wrap(<ActivationCodePage />, '/onboarding/whatsapp/code', {
      displayCode: 'WC-A4K9-JAMIL',
      sharedNumberE164: '+971 4 XXX XXXX',
      expiresAt: '2026-09-09T12:15:00.000Z',
    })
    expect(await screen.findByRole('button', { name: /Copy activation code to clipboard/i })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('WLB-003 FirstMessageWaitingPage has no axe violations', async () => {
    const { container } = wrap(<FirstMessageWaitingPage />, '/onboarding/whatsapp/waiting', {
      phone_e164: '+971501234567',
      bindingId: 'bind-1',
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('WLB-004 ListingDraftingPage (streaming) announces completed fields, not tokens', async () => {
    const { container } = wrap(<ListingDraftingPage />, '/onboarding/whatsapp/drafting/sess_1')
    await waitFor(() => {
      expect(document.querySelector('[data-draft-live]')).toBeTruthy()
    })
    const live = document.querySelector('[data-draft-live]')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveTextContent('3/7')
    expect(live?.textContent).not.toMatch(/Bright 2BR with marina views/)
    const fieldGrid = [...document.querySelectorAll('ol')].find((ol) => ol.textContent?.includes('Address'))
    expect(fieldGrid?.getAttribute('aria-live')).not.toBe('polite')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('WLB-005 ListingDraftingPage complete state announces ready copy', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
    useDraftProgressMock.mockReturnValue(
      progress({
        isReady: true,
        completedCount: 7,
        fields: STREAMING_FIELDS.map((f) =>
          f.state === 'complete' || f.key === 'photos'
            ? f
            : { ...f, state: 'complete' as const, value: f.value ?? f.streamedText ?? 'done' },
        ) as DraftField[],
      }),
    )
    const { container } = wrap(<ListingDraftingPage />, '/onboarding/whatsapp/drafting/sess_1')
    expect(await screen.findByRole('heading', { name: /Your listing is ready/i })).toBeInTheDocument()
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toMatch(/Your listing is ready/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})
