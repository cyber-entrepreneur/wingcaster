// @vitest-environment jsdom
/**
 * Isolated ListingsPage Guided-fallback a11y (D-S-06).
 * Kept separate — importing ListingsPage into the main wave8 a11y/visual
 * suites hangs jsdom workers in this environment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { sampleListings } from '@/theme/wave8-fixtures'

expect.extend(toHaveNoViolations)

const apiMocks = vi.hoisted(() => ({
  getProperties: vi.fn(),
}))

const uiModeState = vi.hoisted(() => ({
  mode: 'pro' as 'guided' | 'pro',
  effectiveMode: 'guided' as 'guided' | 'pro',
  shouldRenderPro: false,
  isProCapable: false,
  loading: false,
  switching: false,
  setMode: vi.fn(async (next: 'guided' | 'pro') => ({ ok: true as const, mode: next })),
  refresh: vi.fn(async () => {}),
}))

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
  api: apiMocks,
  setAuthToken: vi.fn(),
  clearElevatedToken: vi.fn(),
}))

vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => uiModeState,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'usr_sara', name: 'Sara Agent' },
    loading: false,
  }),
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    activeTenant: {
      id: 'personal:usr_sara',
      name: 'Sara Agent',
      kind: 'personal',
      uiMode: 'pro',
    },
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: vi.fn() }))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { ListingsPage } from '@/pages/ListingsPage'

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
  uiModeState.mode = 'pro'
  uiModeState.effectiveMode = 'guided'
  uiModeState.shouldRenderPro = false
  uiModeState.isProCapable = false
  apiMocks.getProperties.mockResolvedValue(sampleListings())
})

afterEach(() => {
  cleanup()
})

describe('Wave 8 ListingsPage Guided fallback <768 (ui_mode=pro)', () => {
  it('does not mount Pro table and passes axe', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/listings']}>
        <Routes>
          <Route path="/listings" element={<ListingsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Listings/i })).toBeInTheDocument()
    })
    expect(screen.queryByTestId('pro-listings-table')).toBeNull()
    expect(screen.queryByRole('region', { name: /Listings table/i })).toBeNull()
    expect(
      await axe(container, {
        rules: {
          'color-contrast': { enabled: false },
          'aria-valid-attr-value': { enabled: false },
        },
      }),
    ).toHaveNoViolations()
  })
})
