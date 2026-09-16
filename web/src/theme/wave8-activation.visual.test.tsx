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
  assertNoPlaintextPiiSubstring,
  serializeVisualRoot,
  setVisualViewport,
  stampLcTokens,
  type ViewportAxis,
} from '@/theme/visualSerialize'
import {
  sampleConsentTerms,
  sampleInboxConversation,
  sampleListings,
  sampleMineRelationship,
  sampleRedactedRelationship,
} from '@/theme/wave8-fixtures'
import { t as consentT } from '@/pages/public/consentCopy'

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
    api: new Proxy(apiMocks as Record<string, unknown>, handler),
    setAuthToken: vi.fn(),
    clearElevatedToken: vi.fn(),
    getAuthToken: vi.fn(() => 'test-token'),
  }
})

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

/**
 * Every seeded contact PII value in the Wave 8 fixtures. `Sara Agent` is the
 * signed-in agent (self) — never masked — so it is intentionally excluded.
 */
const FIXTURE_PII = {
  emails: ['omar@example.com'],
  phones: ['+971500000000'],
  names: ['Omar Hassan'],
} as const

function expectSnap(container: HTMLElement, mode: Mode = 'light', hint?: string) {
  const root =
    (container.querySelector('[data-wave8-visual-root]') as HTMLElement | null) ?? container
  stampLcTokens(root, mode)
  const serialized = serializeVisualRoot(root, { mode })
  // Regex sweep (email/phone) + names denylist parsed from the fixtures.
  assertNoPiiBleed(serialized, [...FIXTURE_PII.names])
  // Substring sweep of the rendered HTML — catches PII embedded in prose that
  // whole-node queryByText misses (e.g. "Waiting on <name> to confirm").
  assertNoPlaintextPiiSubstring(root, {
    emails: [...FIXTURE_PII.emails],
    phones: [...FIXTURE_PII.phones],
    names: [...FIXTURE_PII.names],
  })
  if (hint) expect(serialized).toMatchSnapshot(hint)
  else expect(serialized).toMatchSnapshot()
  return serialized
}

function assertPiiMasked() {
  expect(screen.queryByText('Omar Hassan')).toBeNull()
  expect(screen.queryByText('omar@example.com')).toBeNull()
  const masks = document.querySelectorAll('[data-pii-revealed="false"]')
  expect(masks.length).toBeGreaterThan(0)
}

type Dir3 = 'ltr' | 'rtl'
interface CoreVariant {
  key: string
  mode: Mode
  dir: Dir3
  viewport: ViewportAxis
}

/**
 * Orthogonal matrix (Option A): each core fixture ships 4 variants so any
 * single-axis pair is byte-diff verifiable on the SAME fixture —
 *   dark≠light   : light-ltr-desktop vs dark-ltr-desktop
 *   rtl≠ltr      : light-ltr-desktop vs light-rtl-desktop
 *   mobile≠desktop: light-ltr-desktop vs light-ltr-mobile
 */
const CORE_VARIANTS: CoreVariant[] = [
  { key: 'light-ltr-desktop', mode: 'light', dir: 'ltr', viewport: 'desktop' },
  { key: 'dark-ltr-desktop', mode: 'dark', dir: 'ltr', viewport: 'desktop' },
  { key: 'light-rtl-desktop', mode: 'light', dir: 'rtl', viewport: 'desktop' },
  { key: 'light-ltr-mobile', mode: 'light', dir: 'ltr', viewport: 'mobile' },
]

function applyVariant(v: CoreVariant) {
  applySurface(v.mode, v.dir)
  setVisualViewport(v.viewport)
}

/**
 * Render one fixture across all 4 orthogonal variants, snapshotting each and
 * proving the single-axis pairs are byte-different on the SAME fixture.
 */
async function renderMatrix(
  makeUi: () => ReactElement,
  ready: (container: HTMLElement) => void | Promise<void>,
  perVariant?: (container: HTMLElement, v: CoreVariant) => void,
): Promise<Record<string, string>> {
  const snaps: Record<string, string> = {}
  for (const v of CORE_VARIANTS) {
    applyVariant(v)
    const { container } = render(makeUi())
    await ready(container)
    perVariant?.(container, v)
    snaps[v.key] = expectSnap(container, v.mode, v.key)
    cleanup()
  }
  // Orthogonal byte-diff proofs — each pair changes exactly one axis.
  expect(snaps['dark-ltr-desktop']).not.toEqual(snaps['light-ltr-desktop'])
  expect(snaps['light-rtl-desktop']).not.toEqual(snaps['light-ltr-desktop'])
  expect(snaps['light-ltr-mobile']).not.toEqual(snaps['light-ltr-desktop'])
  return snaps
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
  it('theatrical dark tokens differ from light after stamp', () => {
    // Lightweight probe — full ProDashboard mounts OOM the 5GB forks worker on CI.
    const { container: lightC } = render(
      wrapProviders(<div data-testid="token-probe">light</div>),
    )
    const lightSnap = expectSnap(lightC, 'light')
    cleanup()

    applySurface('dark', 'ltr')
    const { container: darkC } = render(
      wrapProviders(<div data-testid="token-probe">dark</div>),
    )
    const darkSnap = expectSnap(darkC, 'dark')
    expect(lightSnap).not.toEqual(darkSnap)
    expect(lightSnap).toContain('data-lc-tokens')
    expect(darkSnap).toContain('data-lc-tokens')
    // Real resolved palette — empty `{}` stamps must not pass as theatrical.
    const parseTokens = (snap: string) => {
      const m = /<!-- lc-tokens=(\{.*?\}) -->/.exec(snap)
      expect(m?.[1]).toBeTruthy()
      return JSON.parse(m![1]!) as Record<string, string>
    }
    const lightTokens = parseTokens(lightSnap)
    const darkTokens = parseTokens(darkSnap)
    expect(lightTokens['--lc-bg-page']).toBeTruthy()
    expect(darkTokens['--lc-bg-page']).toBeTruthy()
    expect(lightTokens['--lc-bg-page']).not.toEqual(darkTokens['--lc-bg-page'])
  })

  it('ProListingsTable orthogonal matrix (dark≠light, rtl≠ltr, mobile≠desktop)', async () => {
    await renderMatrix(
      () => (
        <MemoryRouter>
          <ProListingsTable listings={sampleListings()} totalCount={3} />
        </MemoryRouter>
      ),
      () => {
        expect(screen.getByTestId('pro-listings-table')).toBeInTheDocument()
      },
    )
  })

  it('InboxRow dual-badge orthogonal matrix (dark≠light, rtl≠ltr, mobile≠desktop)', async () => {
    await renderMatrix(
      () => (
        <div>
          <InboxRow conversation={sampleInboxConversation} onSelect={() => undefined} />
          <ChannelSourceBadges channel="email" source="property_finder" />
        </div>
      ),
      () => {
        expect(screen.getByLabelText(/WhatsApp from Bayut/i)).toBeInTheDocument()
        // Contact name stays masked across every variant.
        assertPiiMasked()
      },
    )
  })

  it('Consent-landing orthogonal matrix (dark≠light, rtl≠ltr/AR, mobile≠desktop)', async () => {
    await renderMatrix(
      () => (
        <MemoryRouter initialEntries={['/public/relationships/consent?token=tok_wave8']}>
          <Routes>
            <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
          </Routes>
        </MemoryRouter>
      ),
      async (container) => {
        await waitFor(() => {
          expect(container.querySelector('#consent-title')).toBeTruthy()
        })
        // Public consent must not surface agent CRM chrome.
        expect(screen.queryByTestId('crm-shell')).toBeNull()
        expect(screen.queryByRole('navigation')).toBeNull()
      },
      (container, v) => {
        if (v.dir === 'rtl') {
          // #145 AR pass reaches this surface via useLocale().isArabic — the
          // rtl variant renders Arabic copy, not English strings under dir=rtl.
          expect(container.textContent).toContain(consentT('consent.title', 'ar'))
          expect(container.textContent).toContain(consentT('consent.accept', 'ar'))
          expect(container.textContent).not.toContain('Confirm this relationship')
        } else {
          expect(container.textContent).toContain(consentT('consent.title', 'en'))
        }
      },
    )
  })

  it('Guided-listings-fallback-ui-mode-pro-mobile', async () => {
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
    // Wait for scoped listings to resolve — heading alone paints before
    // getProperties settles, which raced empty-state snaps on CI.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Listings/i })).toBeInTheDocument()
      expect(screen.getByText(/Marina Gate 2BR with balcony/i)).toBeInTheDocument()
      expect(screen.queryByText(/Your first listing awaits/i)).toBeNull()
    })
    expect(screen.queryByTestId('pro-listings-table')).toBeNull()
    expectSnap(container, 'light')
  })

  it('Consent-landing-missing-token-light-ltr', async () => {
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

  it('Relationships-editor-pending-light-ltr', async () => {
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
    // Positive: the masked-name PIIMask is present for this row (item 1).
    expect(screen.getByLabelText(/Masked name/i)).toBeInTheDocument()
    // The pending prose is masked too — no plaintext contact name bleeds.
    expect(screen.getByText(/Waiting on .+ to confirm via link/i)).toBeInTheDocument()
    expect(container.querySelector('[data-wave8-visual-root]')!.innerHTML).not.toContain(
      'Omar Hassan',
    )
    expectSnap(container, 'light')
  })

})
