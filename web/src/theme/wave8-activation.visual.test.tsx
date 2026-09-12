// @vitest-environment jsdom
/**
 * Wave 8 activation polish — visual / DOM snapshot matrix (Chromatic stand-ins).
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
    locale: 'en' as const,
    setLocale: vi.fn(async () => ({ ok: true as const })),
    dir: 'ltr' as const,
    isArabic: false,
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: vi.fn() }))

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

function setViewport(minWidth: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: minWidth,
  })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const min = query.match(/min-width:\s*(\d+)/)
      const max = query.match(/max-width:\s*(\d+)/)
      let matches = false
      if (min) matches = minWidth >= Number(min[1])
      else if (max) matches = minWidth <= Number(max[1])
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
}

function wrapProviders(ui: ReactElement) {
  return <ToastProvider>{ui}</ToastProvider>
}

function applySurface(mode: Mode, dir: Dir) {
  document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
  document.documentElement.dir = dir
  applyLcMode(mode)
}

function serialize(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[id]').forEach((el, i) => {
    el.setAttribute('id', `snap-${i}`)
  })
  clone.querySelectorAll('[aria-controls]').forEach((el) => {
    el.setAttribute('aria-controls', 'snap-controls')
  })
  clone.querySelectorAll('[aria-labelledby]').forEach((el) => {
    el.setAttribute('aria-labelledby', 'snap-labelledby')
  })
  const mode = document.documentElement.getAttribute('data-lc-mode') || 'light'
  const dir = document.documentElement.dir || 'ltr'
  const lang = document.documentElement.lang || 'en'
  const vw = window.innerWidth
  return `<!-- mode=${mode} dir=${dir} lang=${lang} vw=${vw} -->\n${clone.innerHTML}`
}

function expectSnap(root: HTMLElement) {
  expect(serialize(root)).toMatchSnapshot()
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
  setViewport(1024)
  uiModeState.mode = 'pro'
  uiModeState.effectiveMode = 'pro'
  uiModeState.shouldRenderPro = true
  uiModeState.isProCapable = true
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
})

afterEach(() => {
  cleanup()
})

describe('Wave 8 visual matrix — Chromatic stand-ins', () => {
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
    expectSnap(container)
  })

  it('02 ProDashboard-compact-dark-rtl-desktop', async () => {
    applySurface('dark', 'rtl')
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
    fireEvent.click(screen.getByRole('radio', { name: /compact/i }))
    await waitFor(() => {
      expect(screen.getByTestId('pro-dashboard')).toHaveAttribute('data-density', 'compact')
    })
    expectSnap(container)
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
    expectSnap(container)
  })

  it('04 ProListingsTable-bulk-selected-light-ltr', async () => {
    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <ProListingsTable listings={sampleListings()} totalCount={3} />
        </MemoryRouter>,
      ),
    )
    const region = screen.getByRole('region', { name: /Listings table/i })
    region.focus()
    fireEvent.keyDown(region, { key: ' ' })
    await waitFor(() => {
      expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument()
    })
    expectSnap(container)
  })

  it('05 Guided-fallback-dashboard-ui-mode-pro-mobile', async () => {
    setViewport(375)
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
    expectSnap(container)
  })

  it('06 Guided-listings-fallback-ui-mode-pro-mobile', async () => {
    setViewport(390)
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
    expectSnap(container)
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
    expectSnap(container)
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
    expectSnap(container)
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
    expectSnap(container)
  })

  it('10 Inbox-dual-badge-row-light-ltr', () => {
    const { container } = render(
      <ul>
        <InboxRow conversation={sampleInboxConversation} onSelect={() => undefined} />
        <li>
          <ChannelSourceBadges channel="email" source="property_finder" />
        </li>
      </ul>,
    )
    expect(screen.getByLabelText(/WhatsApp from Bayut/i)).toBeInTheDocument()
    expectSnap(container)
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
    expectSnap(container)
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
    expectSnap(container)
  })
})
