// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { ListingDraftingPage } from './ListingDraftingPage'

vi.mock('@/hooks/useOnboardingState', async () => {
  const { mockUseOnboardingState } = await import('./mockUseOnboardingState')
  return { useOnboardingState: () => mockUseOnboardingState() }
})

vi.mock('./useDraftProgress', async () => {
  const actual = await vi.importActual<typeof import('./useDraftProgress')>('./useDraftProgress')
  return {
    ...actual,
    useDraftProgress: vi.fn(),
  }
})

import { useDraftProgress } from './useDraftProgress'
import type { DraftField } from '@/components/onboarding/whatsapp'

const useDraftProgressMock = vi.mocked(useDraftProgress)

const idle: DraftField[] = [
  { key: 'address', label: 'Address', state: 'idle' },
  { key: 'bedrooms', label: 'Bedrooms', state: 'idle' },
  { key: 'bathrooms', label: 'Bathrooms', state: 'idle' },
  { key: 'price', label: 'Price', state: 'idle' },
  { key: 'area_sqft', label: 'Area (sqft)', state: 'idle' },
  { key: 'description', label: 'Description', state: 'idle' },
  { key: 'photos', label: 'Photos', state: 'idle' },
]

function readyFields(): DraftField[] {
  return [
    { key: 'address', label: 'Address', state: 'complete', value: '42 Marina Walk, Dubai Marina' },
    { key: 'bedrooms', label: 'Bedrooms', state: 'complete', value: 3 },
    { key: 'bathrooms', label: 'Bathrooms', state: 'complete', value: 2 },
    { key: 'price', label: 'Price', state: 'complete', value: 2450000 },
    { key: 'area_sqft', label: 'Area (sqft)', state: 'complete', value: 1850 },
    {
      key: 'description',
      label: 'Description',
      state: 'complete',
      value: 'Bright marina apartment with a skyline view.',
    },
    { key: 'photos', label: 'Photos', state: 'complete', value: ['https://img.test/1.jpg'] },
  ]
}

function baseProgress(over: Partial<ReturnType<typeof useDraftProgress>> = {}) {
  return {
    fields: idle,
    connection: 'sse' as const,
    transport: 'sse' as const,
    isReady: false,
    isConnecting: false,
    error: null,
    draftId: 'draft-1',
    completedCount: 0,
    totalCount: 7,
    ...over,
  }
}

function renderDrafting() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/onboarding/whatsapp/drafting/sess-1']}>
        <Routes>
          <Route path="/onboarding/whatsapp/drafting/:sessionId" element={<ListingDraftingPage />} />
          <Route path="/listings/:listingId" element={<div>LISTING_DETAIL</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  useDraftProgressMock.mockReturnValue(baseProgress())
})

describe('ListingDraftingPage', () => {
  it('shows LiveDraftCanvas while SSE drafting and keeps the primary CTA disabled', () => {
    renderDrafting()
    expect(screen.getByRole('heading', { name: /Turning your message into a listing/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Drafting/i })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: /Your listing is ready/i })).not.toBeInTheDocument()
  })

  it('shows the determinate spinner copy in fallback transport — no fake field stream', () => {
    useDraftProgressMock.mockReturnValue(
      baseProgress({
        transport: 'fallback',
        connection: 'fallback',
        fields: idle,
      }),
    )
    renderDrafting()
    expect(screen.getByText(/Drafting your listing… this usually takes 15-30s/i)).toBeInTheDocument()
    expect(screen.queryByText('Waiting for input…')).not.toBeInTheDocument()
  })

  it('cross-fades to the success hero after draft-ready (reduced motion: immediate)', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    useDraftProgressMock.mockReturnValue(
      baseProgress({
        isReady: true,
        fields: readyFields(),
        completedCount: 7,
      }),
    )
    renderDrafting()
    expect(await screen.findByRole('heading', { name: /Your listing is ready/i })).toBeInTheDocument()
    expect(screen.getByText(/42 Marina Walk/i)).toBeInTheDocument()
  })

  it('primary CTA on the ready phase navigates to the listing review route', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    useDraftProgressMock.mockReturnValue(
      baseProgress({
        isReady: true,
        fields: readyFields(),
        completedCount: 7,
      }),
    )
    renderDrafting()
    const ctas = await screen.findAllByRole('button', { name: /Review & publish/i })
    await user.click(ctas[ctas.length - 1])
    await waitFor(() => expect(screen.getByText('LISTING_DETAIL')).toBeInTheDocument())
  })
})
