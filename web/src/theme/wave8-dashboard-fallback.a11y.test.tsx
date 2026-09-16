// @vitest-environment jsdom
/**
 * D-S-06 Guided *dashboard* fallback a11y — the real AgentDashboardPage guided
 * variant (ui_mode=pro, viewport <768), mounted under the same <Routes> harness
 * as wave8-listings-fallback.a11y.test.tsx and axe'd for real.
 *
 * Replaces the prior guided-slot `<div>` stand-in (which made axe pass
 * trivially). Kept isolated in its own file because the AgentDashboardPage
 * module graph is heavy.
 *
 * NOTE: every mocked hook returns a *stable* reference (hoisted objects). The
 * guided dashboard memoizes its data-load `useCallback` on `agent`/`addToast`;
 * returning a fresh object per render invalidates that callback and drives an
 * async re-render loop that OOMs the 4GB CI worker. Stable refs keep it flat.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

const AXE_OPTS = {
  rules: {
    // jsdom cannot compute color-contrast; React useId colon ids trip
    // aria-valid-attr-value; nested row/button chrome trips nested-interactive.
    'color-contrast': { enabled: false },
    'aria-valid-attr-value': { enabled: false },
    'nested-interactive': { enabled: false },
  },
} as const

const apiMocks = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('@/api/client', () => {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver)
      if (typeof prop === 'symbol') return undefined
      const fn = vi.fn(async () => [])
      target[prop as string] = fn
      return fn
    },
  }
  return {
    API_BASE: '/api',
    api: new Proxy(apiMocks, handler),
    setAuthToken: vi.fn(),
    clearElevatedToken: vi.fn(),
    getAuthToken: vi.fn(() => 'test-token'),
  }
})

// D-S-06: ui_mode=pro but viewport <768 → effectiveMode resolves to guided.
const uiModeMock = vi.hoisted(() => ({
  mode: 'pro' as const,
  effectiveMode: 'guided' as const,
  shouldRenderPro: false,
  isProCapable: false,
  loading: false,
  switching: false,
  setMode: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('@/hooks/useUiMode', () => ({ useUiMode: () => uiModeMock }))

const authState = vi.hoisted(() => ({
  agent: {
    id: 'usr_sara',
    name: 'Sara Agent',
    email: 'sara@wingcaster.test',
    phone: '+971500000001',
    agency_name: 'Personal',
    license_number: 'BRN-1001',
    rating: 4.9,
    review_count: 12,
  },
  isAdmin: false,
  loading: false,
  updateProfile: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshAgent: vi.fn(),
  completeTwoFactor: vi.fn(),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authState }))

const localeMock = vi.hoisted(() => ({
  locale: 'en' as const,
  isArabic: false,
  dir: 'ltr' as const,
  setLocale: vi.fn(),
}))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => localeMock }))

const onboardingMock = vi.hoisted(() => ({ patch: vi.fn(), isLoading: false, isError: false }))
vi.mock('@/hooks/useOnboardingState', () => ({ useOnboardingState: () => onboardingMock }))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: vi.fn() }))

const toastState = vi.hoisted(() => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] as unknown[] }))
vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>('@/components/ui/toast')
  return { ...actual, useToast: () => toastState }
})

import { AgentDashboardPage } from '@/pages/AgentDashboardPage'

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const max = query.match(/max-width:\s*(\d+)/)
      const min = query.match(/min-width:\s*(\d+)/)
      let matches = false
      if (min) matches = 375 >= Number(min[1])
      else if (max) matches = 375 <= Number(max[1])
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    },
  })
})

afterEach(() => {
  cleanup()
})

describe('Wave 8 a11y — Guided dashboard fallback <768 (ui_mode=pro), real render', () => {
  it('mounts the real AgentDashboardPage guided shell (not Pro) and passes axe', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<AgentDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Real guided dashboard content — not the Pro shell, not a <div> stub.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Sara Agent/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 2, name: /My Property Listings/i })).toBeInTheDocument()
    expect(screen.queryByTestId('pro-dashboard')).toBeNull()
    expect(screen.getByRole('tablist')).toBeInTheDocument()

    expect(await axe(container, AXE_OPTS)).toHaveNoViolations()
  })
})
