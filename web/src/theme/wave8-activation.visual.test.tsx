// @vitest-environment jsdom
/**
 * Wave 8 activation polish — visual / DOM snapshot matrix (Chromatic stand-ins).
 *
 * Dark ≠ light byte-for-byte: serialize stamps resolved `--lc-*` values as
 * `data-lc-tokens` on the wrapper (jsdom class strings stay `var(--lc-*)`).
 *
 * Chromatic / Storybook are not configured — see scratchpad/wave8-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import {
  assertNoPiiBleed,
  serializeVisualRoot,
  setVisualViewport,
  stampLcTokens,
} from '@/theme/visualSerialize'
import {
  sampleConsentTerms,
  sampleInboxConversation,
  sampleListings,
  sampleMineRelationship,
  sampleRedactedRelationship,
} from '@/theme/wave8-fixtures'

type Mode = 'light' | 'dark'
type Dir = 'ltr' | 'rtl'

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

const apiMocks = vi.hoisted(() => ({
  getPublicRelationshipConsent: vi.fn(),
  acceptPublicRelationshipConsent: vi.fn(),
  rejectPublicRelationshipConsent: vi.fn(),
  getContact: vi.fn(),
  getContactRelationshipsMine: vi.fn(),
  getContactRelationshipsOther: vi.fn(),
  createContactRelationship: vi.fn(),
  updateContactRelationship: vi.fn(),
  deleteContactRelationship: vi.fn(),
  resendRelationshipConsentLink: vi.fn(),
  getProperties: vi.fn(),
  getDashboardStats: vi.fn(),
  getInquiries: vi.fn(),
  getViewings: vi.fn(),
  getConversations: vi.fn(),
  getDashboardOperations: vi.fn(),
  getDashboardAnalytics: vi.fn(),
}))

const uiModeState = vi.hoisted(() => ({
  mode: 'pro' as 'guided' | 'pro',
  effectiveMode: 'pro' as 'guided' | 'pro',
  shouldRenderPro: true,
  isProCapable: true,
  loading: false,
  switching: false,
  setMode: vi.fn(async (next: 'guided' | 'pro') => ({ ok: true as const, mode: next })),
  refresh: vi.fn(async () => {}),
}))

const localeState = vi.hoisted(() => ({
  locale: 'en' as 'en' | 'ar',
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
    agent: { id: 'usr_sara', name: 'Sara Agent', email: 'sara@wingcaster.test' },
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshAgent: vi.fn(),
    completeTwoFactor: vi.fn(),
  }),
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    tenants: [
      {
        id: 'personal:usr_sara',
        name: 'Sara Agent',
        kind: 'personal',
        role: 'owner',
        avatarUrl: null,
        listingsCount: 3,
        agentsCount: 1,
        uiMode: 'pro',
      },
    ],
    activeTenantId: 'personal:usr_sara',
    activeTenant: {
      id: 'personal:usr_sara',
      name: 'Sara Agent',
      kind: 'personal',
      role: 'owner',
      avatarUrl: null,
      listingsCount: 3,
      agentsCount: 1,
      uiMode: 'pro',
    },
    loading: false,
    switching: false,
    error: null,
    isMultiTenant: false,
    refresh: vi.fn(),
    switchTenant: vi.fn(),
  }),
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: localeState.locale,
    setLocale: vi.fn(async () => ({ ok: true as const })),
    dir: localeState.locale === 'ar' ? ('rtl' as const) : ('ltr' as const),
    isArabic: localeState.locale === 'ar',
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: vi.fn() }))

const dashboardLayoutState = vi.hoisted(() => ({
  layout: [
    { i: 'kpi-listings', x: 0, y: 0, w: 3, h: 2 },
    { i: 'kpi-views', x: 3, y: 0, w: 3, h: 2 },
  ],
  density: 'comfortable' as 'comfortable' | 'compact' | 'spacious',
  saveState: 'idle' as const,
  setLayout: vi.fn(),
  setDensity: vi.fn((next: 'comfortable' | 'compact' | 'spacious') => {
    dashboardLayoutState.density = next
  }),
  resetLayout: vi.fn(),
  removeWidget: vi.fn(),
  addWidget: vi.fn(),
}))

vi.mock('@/hooks/useDashboardLayout', () => ({
  useDashboardLayout: () => dashboardLayoutState,
}))

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>('@/components/ui/toast')
  return {
    ...actual,
    useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
  }
})

import { ProDashboard } from '@/pages/agent/dashboard/ProDashboard'
import { AgentDashboardProGate } from '@/pages/agent/dashboard/AgentDashboardModeMount'
import { ProListingsTable } from '@/pages/agent/listings/ProListingsTable'
import { RelationshipConsentPage } from '@/pages/public/RelationshipConsentPage'
import { RelationshipsEditorPage } from '@/pages/agent/contacts/RelationshipsEditorPage'
import { ChannelSourceBadges } from '@/components/inbox/ChannelSourceBadges'
import { InboxRow } from '@/components/inbox/InboxRow'
import { ListingsPage } from '@/pages/ListingsPage'

function applySurface(mode: Mode, dir: Dir) {
  document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
  document.documentElement.dir = dir
  localeState.locale = dir === 'rtl' ? 'ar' : 'en'
  applyLcMode(mode)
}

function wrapProviders(ui: ReactElement) {
  return (
    <ToastProvider>
      <div data-wave8-visual-root>{ui}</div>
    </ToastProvider>
  )
}

function expectSnap(container: HTMLElement, mode: Mode = 'light') {
  const root =
    (container.querySelector('[data-wave8-visual-root]') as HTMLElement | null) ?? container
  stampLcTokens(root, mode)
  const serialized = serializeVisualRoot(root, { mode })
  assertNoPiiBleed(serialized)
  expect(serialized).toMatchSnapshot()
  return serialized
}

function assertPiiMasked() {
  expect(screen.queryByText('Omar Hassan')).toBeNull()
  expect(screen.queryByText('omar@example.com')).toBeNull()
  const masks = document.querySelectorAll('[data-pii-revealed="false"]')
  expect(masks.length).toBeGreaterThan(0)
}

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  if (!document.getElementById('broadcast-theme-css')) {
    const style = document.createElement('style')
    style.id = 'broadcast-theme-css'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }
  vi.spyOn(Date.prototype, 'getHours').mockReturnValue(10)
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('9/1/2026')
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () =>
      ({
        format: () => 'Saturday, September 12',
      }) as Intl.DateTimeFormat,
  )
})

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  applySurface('light', 'ltr')
  setVisualViewport('desktop')
  uiModeState.mode = 'pro'
  uiModeState.effectiveMode = 'pro'
  uiModeState.shouldRenderPro = true
  uiModeState.isProCapable = true
  localeState.locale = 'en'
  dashboardLayoutState.density = 'comfortable'
  apiMocks.getPublicRelationshipConsent.mockResolvedValue(sampleConsentTerms())
  apiMocks.getContact.mockResolvedValue({
    id: 'cnt_wave8',
    name: 'Omar Hassan',
    email: 'omar@example.com',
    phone: '+971500000000',
  })
  apiMocks.getContactRelationshipsMine.mockResolvedValue({
    relationships: [sampleMineRelationship()],
  })
  apiMocks.getContactRelationshipsOther.mockResolvedValue({
    relationships: [sampleRedactedRelationship()],
    disabled: false,
  })
  apiMocks.getProperties.mockResolvedValue(sampleListings())
  apiMocks.getDashboardStats.mockResolvedValue({
    listings: 12,
    totalViews: 4200,
    inquiries: 18,
  })
  apiMocks.getInquiries.mockResolvedValue({ items: [] })
  apiMocks.getViewings.mockResolvedValue([])
  apiMocks.getConversations.mockResolvedValue([])
  apiMocks.getDashboardOperations.mockResolvedValue(null)
  apiMocks.getDashboardAnalytics.mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
})

describe('Wave 8 visual matrix — Chromatic stand-ins', () => {
  it('theatrical dark tokens differ from light after stamp', async () => {
    const { container: lightC } = render(
      wrapProviders(
        <MemoryRouter>
          <ProDashboard
            greetingName="Sara"
            stats={{ listings: 12, activeListings: 9, totalViews: 4200, inquiries: 18 }}
          />
        </MemoryRouter>,
      ),
    )
    await waitFor(() => expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument())
    const lightSnap = expectSnap(lightC, 'light')
    cleanup()

    applySurface('dark', 'ltr')
    const { container: darkC } = render(
      wrapProviders(
        <MemoryRouter>
          <ProDashboard
            greetingName="Sara"
            stats={{ listings: 12, activeListings: 9, totalViews: 4200, inquiries: 18 }}
          />
        </MemoryRouter>,
      ),
    )
    await waitFor(() => expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument())
    const darkSnap = expectSnap(darkC, 'dark')
    expect(lightSnap).not.toEqual(darkSnap)
    expect(lightSnap).toContain('data-lc-tokens')
    expect(darkSnap).toContain('data-lc-tokens')
  })

  it('01 ProDashboard-comfortable-light-ltr-desktop', async () => {
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <ProDashboard
            greetingName="Sara"
            stats={{ listings: 12, activeListings: 9, totalViews: 4200, inquiries: 18 }}
          />
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument()
    })
    expectSnap(container, 'light')
  })

  it('02 ProDashboard-compact-dark-rtl-desktop', async () => {
    applySurface('dark', 'rtl')
    dashboardLayoutState.density = 'compact'
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <ProDashboard
            greetingName="Sara"
            stats={{ listings: 12, activeListings: 9, totalViews: 4200, inquiries: 18 }}
          />
        </MemoryRouter>,
      ),
    )
    await waitFor(() => expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument())
    expect(screen.getByTestId('pro-dashboard')).toHaveAttribute('data-density', 'compact')
    // AR copy via useLocale + LOGIN_COPY
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/يوم سعيد/)
    expectSnap(container, 'dark')
  })

  it('03 ProListingsTable-light-ltr-desktop', async () => {
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <ProListingsTable listings={sampleListings()} totalCount={3} />
        </MemoryRouter>,
      ),
    )
    expect(screen.getByTestId('pro-listings-table')).toBeInTheDocument()
    expectSnap(container, 'light')
  })

  it('04 ProListingsTable-bulk-selected-light-ltr', async () => {
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <ProListingsTable listings={sampleListings()} totalCount={3} />
        </MemoryRouter>,
      ),
    )
    const checkbox = screen.getByRole('checkbox', { name: /Select Marina Gate/i })
    fireEvent.click(checkbox)
    await waitFor(() => {
      expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument()
    })
    expectSnap(container, 'light')
  })

  it('04b ProListingsTable-bulk-selected-dark-rtl', async () => {
    applySurface('dark', 'rtl')
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <ProListingsTable listings={sampleListings()} totalCount={3} />
        </MemoryRouter>,
      ),
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /Select Marina Gate/i }))
    await waitFor(() => expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument())
    expectSnap(container, 'dark')
  })

  it('05 Guided-fallback-dashboard-ui-mode-pro-mobile', async () => {
    setVisualViewport('mobile')
    uiModeState.mode = 'pro'
    uiModeState.effectiveMode = 'guided'
    uiModeState.shouldRenderPro = false
    uiModeState.isProCapable = false
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <AgentDashboardProGate guided={<div data-testid="guided-dashboard">Guided dashboard</div>} />
        </MemoryRouter>,
      ),
    )
    expect(screen.getByTestId('guided-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pro-dashboard')).toBeNull()
    expectSnap(container, 'light')
  })

  it('06 Guided-listings-fallback-ui-mode-pro-mobile', async () => {
    setVisualViewport('mobile')
    expect(window.innerWidth).toBe(375)
    uiModeState.mode = 'pro'
    uiModeState.effectiveMode = 'guided'
    uiModeState.shouldRenderPro = false
    uiModeState.isProCapable = false
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/listings']}>
          <Routes>
            <Route path="/listings" element={<ListingsPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Listings/i })).toBeInTheDocument()
    })
    expect(screen.queryByTestId('pro-listings-table')).toBeNull()
    expect(uiModeState.mode).toBe('pro')
    expect(uiModeState.isProCapable).toBe(false)
    expectSnap(container, 'light')
  })

  it('07 Consent-landing-ready-light-ltr', async () => {
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/public/relationships/consent?token=tok_wave8']}>
          <Routes>
            <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confirm this relationship/i })).toBeInTheDocument()
    })
    expect(container.querySelector('[data-public-viewer="true"]')).toBeTruthy()
    expectSnap(container, 'light')
  })

  it('07b Consent-landing-ready-light-ltr-mobile', async () => {
    setVisualViewport('mobile')
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/public/relationships/consent?token=tok_wave8']}>
          <Routes>
            <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confirm this relationship/i })).toBeInTheDocument()
    })
    expectSnap(container, 'light')
  })

  it('08 Consent-landing-ready-dark-rtl', async () => {
    applySurface('dark', 'rtl')
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/public/relationships/consent?token=tok_wave8']}>
          <Routes>
            <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confirm this relationship/i })).toBeInTheDocument()
    })
    expectSnap(container, 'dark')
  })

  it('09 Consent-landing-missing-token-light-ltr', async () => {
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/public/relationships/consent?contactId=spoof']}>
          <Routes>
            <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expectSnap(container, 'light')
  })

  it('09b Consent-landing-missing-token-dark-rtl', async () => {
    applySurface('dark', 'rtl')
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/public/relationships/consent?contactId=spoof']}>
          <Routes>
            <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expectSnap(container, 'dark')
  })

  it('10 Inbox-dual-badge-row-light-ltr', () => {
    const { container } = render(
      wrapProviders(
        <div>
          <InboxRow conversation={sampleInboxConversation} onSelect={() => undefined} />
          <ChannelSourceBadges channel="email" source="property_finder" />
        </div>,
      ),
    )
    expect(screen.getByLabelText(/WhatsApp from Bayut/i)).toBeInTheDocument()
    assertPiiMasked()
    expectSnap(container, 'light')
  })

  it('10b Inbox-dual-badge-row-dark-rtl-mobile', () => {
    applySurface('dark', 'rtl')
    setVisualViewport('mobile')
    const { container } = render(
      wrapProviders(
        <div>
          <InboxRow conversation={sampleInboxConversation} onSelect={() => undefined} />
          <ChannelSourceBadges channel="email" source="property_finder" />
        </div>,
      ),
    )
    assertPiiMasked()
    expectSnap(container, 'dark')
  })

  it('11 Relationships-editor-pending-light-ltr', async () => {
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/contacts/cnt_wave8/relationships']}>
          <Routes>
            <Route path="/contacts/:contactId/relationships" element={<RelationshipsEditorPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Relationships' })).toBeInTheDocument()
    })
    assertPiiMasked()
    expectSnap(container, 'light')
  })

  it('11b Relationships-editor-pending-dark-rtl-mobile', async () => {
    applySurface('dark', 'rtl')
    setVisualViewport('mobile')
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/contacts/cnt_wave8/relationships']}>
          <Routes>
            <Route path="/contacts/:contactId/relationships" element={<RelationshipsEditorPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Relationships' })).toBeInTheDocument()
    })
    assertPiiMasked()
    expectSnap(container, 'dark')
  })

  it('12 ProListingsTable-dark-rtl-desktop', async () => {
    applySurface('dark', 'rtl')
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <ProListingsTable listings={sampleListings()} totalCount={3} showOwnerColumn />
        </MemoryRouter>,
      ),
    )
    expect(screen.getByTestId('pro-listings-table')).toBeInTheDocument()
    expectSnap(container, 'dark')
  })

  it('13 ProDashboard-listings-mobile-guided', async () => {
    setVisualViewport('mobile')
    applySurface('light', 'ltr')
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <ProListingsTable listings={sampleListings()} totalCount={3} />
        </MemoryRouter>,
      ),
    )
    expect(screen.getByTestId('pro-listings-table')).toBeInTheDocument()
    expectSnap(container, 'light')
  })
})
