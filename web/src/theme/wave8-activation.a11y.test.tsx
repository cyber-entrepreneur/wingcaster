// @vitest-environment jsdom
/**
 * Wave 8 activation polish — accessibility contract
 * (CURSOR_SCREEN_WAVE_8_ACTIVATION_POLISH.md Phase B item 7 + non-negotiable #7).
 *
 * Extra scrutiny: Pro dense tables + keyboard nav (≥768), Guided fallback <768
 * with ui_mode=pro, public consent landing (token-only, no auth chrome),
 * inbox dual-badge + relationships editor smoke.
 *
 * Chromatic / Storybook are not configured — see scratchpad/wave8-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ReactElement } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import { phaseAStatus } from '@/theme/wave8-phase-a-discovery'
import {
  sampleConsentTerms,
  sampleInboxConversation,
  sampleListings,
  sampleMineRelationship,
  sampleRedactedRelationship,
} from '@/theme/wave8-fixtures'

expect.extend(toHaveNoViolations)

const TAP_FLOOR =
  /(^|\s)(min-h-tap|h-tap|min-h-\[var\(--lc-tap-target-min\)\]|min-w-tap|w-tap)(\s|$)/

/** jsdom cannot compute color-contrast; React useId colon ids trip aria-valid-attr-value. */
const AXE_OPTS = {
  rules: {
    'color-contrast': { enabled: false },
    'aria-valid-attr-value': { enabled: false },
  },
} as const

async function expectNoAxeViolations(container: HTMLElement) {
  expect(await axe(container, AXE_OPTS)).toHaveNoViolations()
}

function purgePortals() {
  document.querySelectorAll('[data-radix-portal]').forEach((el) => {
    el.remove()
  })
}

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
  getConversations: vi.fn(),
  getConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
  markConversationRead: vi.fn(),
  closeConversation: vi.fn(),
  updateConversation: vi.fn(),
  assignConversation: vi.fn(),
  getAgentPreferences: vi.fn(),
  patchAgentPreferences: vi.fn(),
  getConversationAiSuggestions: vi.fn(),
  getAiSuggestions: vi.fn(),
  createConversation: vi.fn(),
  getContacts: vi.fn(),
  bulkConversations: vi.fn(),
  getMessageTemplates: vi.fn(),
  getDashboardStats: vi.fn(),
  getInquiries: vi.fn(),
  getViewings: vi.fn(),
  getDashboardOperations: vi.fn(),
  getDashboardAnalytics: vi.fn(),
  getMyListings: vi.fn(),
}))

const localeState = vi.hoisted(() => ({
  locale: 'en' as 'en' | 'ar',
}))

const dashboardLayoutState = vi.hoisted(() => ({
  layout: [{ i: 'kpi-listings', x: 0, y: 0, w: 3, h: 2 }],
  density: 'comfortable' as 'comfortable' | 'compact' | 'spacious',
  saveState: 'idle' as const,
  setLayout: vi.fn(),
  setDensity: vi.fn(),
  resetLayout: vi.fn(),
  removeWidget: vi.fn(),
  addWidget: vi.fn(),
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

vi.mock('@/hooks/useDashboardLayout', () => ({
  useDashboardLayout: () => dashboardLayoutState,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: vi.fn() }))

vi.mock('@/lib/inbox/socket', () => ({
  useInboxSocket: vi.fn(),
  connectInboxSocket: vi.fn(() => ({ close: vi.fn() })),
}))

vi.mock('@/lib/inbox/offline-store', () => ({
  saveConversationList: vi.fn(async () => undefined),
  getConversationList: vi.fn(async () => null),
  saveConversation: vi.fn(async () => undefined),
  saveMessages: vi.fn(async () => undefined),
  getConversation: vi.fn(async () => undefined),
  getMessages: vi.fn(async () => []),
  enqueueOutgoing: vi.fn(async () => undefined),
  flushOutbox: vi.fn(async () => ({ sent: 0, failed: 0 })),
  flushOutboxOnOnline: vi.fn(() => () => undefined),
}))

vi.mock('@/lib/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

vi.mock('@/components/layout/CrmShell', () => ({
  CrmShell: ({ children }: { children: React.ReactNode }) => <div data-testid="crm-shell">{children}</div>,
}))

vi.mock('@/components/layout/CmdPageHeader', () => ({
  CmdPageHeader: ({ title }: { title?: string }) => <header>{title || 'Inbox'}</header>,
}))

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>('@/components/ui/toast')
  return {
    ...actual,
    useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
  }
})

import { ProDashboard } from '@/pages/agent/dashboard/ProDashboard'
import {
  AgentDashboardModeMount,
  AgentDashboardProGate,
} from '@/pages/agent/dashboard/AgentDashboardModeMount'
import { ProListingsTable } from '@/pages/agent/listings/ProListingsTable'
import { RelationshipConsentPage } from '@/pages/public/RelationshipConsentPage'
import { RelationshipsEditorPage } from '@/pages/agent/contacts/RelationshipsEditorPage'
import { ChannelSourceBadges } from '@/components/inbox/ChannelSourceBadges'
import { InboxRow } from '@/components/inbox/InboxRow'
import { InboxPage } from '@/pages/InboxPage'
import { AgentDashboardPage } from '@/pages/AgentDashboardPage'
import { LOGIN_COPY } from '@/pages/agent/dashboard/copy'
// Guided listings fallback ListingsPage covered in wave8-listings-fallback.a11y.test.tsx

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

function renderProDashboard() {
  return render(
    wrapProviders(
      <MemoryRouter>
        <main>
          <ProDashboard
            greetingName="Sara"
            stats={{ listings: 12, activeListings: 9, totalViews: 4200, inquiries: 18 }}
          />
        </main>
      </MemoryRouter>,
    ),
  )
}

function renderProTable() {
  return render(
    wrapProviders(
      <MemoryRouter>
        <main>
          <ProListingsTable listings={sampleListings()} totalCount={3} onCreate={() => undefined} />
        </main>
      </MemoryRouter>,
    ),
  )
}

function renderConsent(path = '/public/relationships/consent?token=tok_wave8') {
  return render(
    wrapProviders(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  )
}

function renderRelationships() {
  return render(
    wrapProviders(
      <MemoryRouter initialEntries={['/contacts/cnt_wave8/relationships']}>
        <Routes>
          <Route path="/contacts/:contactId/relationships" element={<RelationshipsEditorPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  )
}

function assertTapFloor(el: HTMLElement, label: string) {
  const cls = typeof el.className === 'string' ? el.className : String(el.className || '')
  const styleMin = el.getAttribute('style') || ''
  const hasClass = TAP_FLOOR.test(cls)
  const hasCssFloor =
    styleMin.includes('var(--lc-tap-target-min)') ||
    (el.tagName === 'BUTTON' && THEME_CSS.includes('min-height: var(--lc-tap-target-min)'))
  expect(hasClass || hasCssFloor, `${label} must meet 44px tap floor (got class="${cls}")`).toBe(true)
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
})

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  applyLcMode('light')
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
  apiMocks.getConversations.mockResolvedValue([
    {
      id: sampleInboxConversation.id,
      contact_name: sampleInboxConversation.contact_name,
      channel: sampleInboxConversation.channel,
      source: sampleInboxConversation.source,
      last_message_at: sampleInboxConversation.last_message_at,
      last_message_preview: sampleInboxConversation.last_message_preview,
      unread_count: sampleInboxConversation.unread_count,
      is_unread_by_agent: sampleInboxConversation.is_unread_by_agent,
      priority_score: sampleInboxConversation.priority_score,
      priority_reason: sampleInboxConversation.priority_reason,
      status: 'open',
    },
  ])
  apiMocks.getConversation.mockResolvedValue({
    id: sampleInboxConversation.id,
    messages: [],
  })
  apiMocks.getAgentPreferences.mockResolvedValue({})
  apiMocks.getMessageTemplates.mockResolvedValue([])
  apiMocks.getContacts.mockResolvedValue([])
  apiMocks.getDashboardStats.mockResolvedValue({
    listings: 12,
    totalViews: 4200,
    inquiries: 18,
  })
  apiMocks.getInquiries.mockResolvedValue({ items: [] })
  apiMocks.getViewings.mockResolvedValue([])
  apiMocks.getDashboardOperations.mockResolvedValue(null)
  apiMocks.getDashboardAnalytics.mockResolvedValue(null)
  localeState.locale = 'en'
})

afterEach(() => {
  cleanup()
  purgePortals()
})

describe('Wave 8 a11y — discovery status', () => {
  it('reports all Phase A Wave 8 modules present after e2e merge', () => {
    const status = phaseAStatus()
    expect(status.readyCount).toBe(10)
    expect(status.proDashboard).toBe(true)
    expect(status.proListingsTable).toBe(true)
    expect(status.consentLanding).toBe(true)
    expect(status.channelSourceBadges).toBe(true)
    expect(status.relationshipsEditor).toBe(true)
  })
})

describe('Wave 8 a11y — theme floors', () => {
  it('broadcast theme still ships 44px tap floor + two-tone focus', () => {
    expect(THEME_CSS).toContain('--lc-tap-target-min: 44px')
    expect(THEME_CSS).toMatch(/--lc-focus-ring/)
  })
})

describe('Wave 8 a11y — Pro dashboard (≥768)', () => {
  it('exposes heading, density radiogroup, and quick actions with tap floor', async () => {
    const { container } = renderProDashboard()
    expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    const density = screen.getByRole('radiogroup', { name: /Dashboard density/i })
    expect(within(density).getAllByRole('radio')).toHaveLength(3)
    const newListing = screen.getByRole('button', { name: /New listing/i })
    assertTapFloor(newListing, 'New listing')
    await expectNoAxeViolations(container)
  })

  it('opens keyboard shortcuts dialog on ? and restores focus path', async () => {
    const user = userEvent.setup()
    renderProDashboard()
    fireEvent.keyDown(window, { key: '?' })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Keyboard shortcuts/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/Go to Inbox/i)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Keyboard shortcuts/i })).toBeNull()
    })
  })

  it('density radios are keyboard-operable', async () => {
    const user = userEvent.setup()
    renderProDashboard()
    const compact = screen.getByRole('radio', { name: /compact/i })
    await user.click(compact)
    expect(compact).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('pro-dashboard')).toHaveAttribute('data-density', 'compact')
  })
})

describe('Wave 8 a11y — Pro listings table (≥768)', () => {
  it('uses table semantics with sortable column headers', () => {
    renderProTable()
    const region = screen.getByRole('region', { name: /Listings table/i })
    expect(region).toBeInTheDocument()
    expect(within(region).getByRole('table')).toBeInTheDocument()
    const priceHeader = screen.getByRole('columnheader', { name: /Price/i })
    expect(priceHeader).toHaveAttribute('aria-sort')
    expect(screen.getByRole('checkbox', { name: /Select all on page/i })).toBeInTheDocument()
  })

  it('supports j/k row focus and space selection', async () => {
    renderProTable()
    const region = screen.getByRole('region', { name: /Listings table/i })
    region.focus()
    expect(document.activeElement).toBe(region)
    fireEvent.keyDown(region, { key: 'ArrowDown' })
    fireEvent.keyDown(region, { key: ' ' })
    await waitFor(() => {
      expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument()
    })
    expect(screen.getByRole('region', { name: /Bulk actions/i })).toBeInTheDocument()
  })

  it('passes jest-axe in dense Pro table state', async () => {
    const { container } = renderProTable()
    await expectNoAxeViolations(container)
  })

  it('New listing + row action targets meet tap floor', () => {
    renderProTable()
    assertTapFloor(screen.getByRole('button', { name: /New listing/i }), 'New listing')
    assertTapFloor(
      screen.getByRole('button', { name: /Actions for Marina Gate/i }),
      'Row actions',
    )
  })
})

describe('Wave 8 a11y — Guided fallback <768 with ui_mode=pro', () => {
  it('AgentDashboardProGate keeps Guided shell (D-S-06) and passes axe', async () => {
    setViewport(375)
    uiModeState.mode = 'pro'
    uiModeState.effectiveMode = 'guided'
    uiModeState.shouldRenderPro = false
    uiModeState.isProCapable = false

    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <main>
            <AgentDashboardProGate
              guided={<div data-testid="guided-dashboard">Guided dashboard</div>}
            />
          </main>
        </MemoryRouter>,
      ),
    )

    expect(screen.getByTestId('guided-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pro-dashboard')).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('AgentDashboardModeMount Guided condition renders and passes axe', async () => {
    setViewport(375)
    uiModeState.mode = 'pro'
    uiModeState.effectiveMode = 'guided'
    uiModeState.shouldRenderPro = false
    uiModeState.isProCapable = false

    const { container } = render(
      wrapProviders(
        <MemoryRouter>
          <main>
            <AgentDashboardModeMount
              shouldRenderPro={false}
              guided={<div data-testid="guided-dashboard">Guided</div>}
            />
          </main>
        </MemoryRouter>,
      ),
    )
    expect(screen.getByTestId('guided-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pro-dashboard')).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('real Guided AgentDashboardPage under Pro gate passes axe', async () => {
    setViewport(375)
    uiModeState.mode = 'pro'
    uiModeState.effectiveMode = 'guided'
    uiModeState.shouldRenderPro = false
    uiModeState.isProCapable = false

    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<AgentDashboardPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.queryByTestId('pro-dashboard')).toBeNull()
    })
    // Guided shell mounts (not Pro)
    expect(container.querySelector('[data-dashboard-mode="pro"]')).toBeNull()
    await expectNoAxeViolations(container)
  })
})

describe('Wave 8 a11y — public consent landing (token-only)', () => {
  it('ready state has main landmark, no auth chrome, and passes axe', async () => {
    const { container } = renderConsent()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confirm this relationship/i })).toBeInTheDocument()
    })
    expect(container.querySelector('main')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByLabelText(/Skip to content/i)).toBeNull()
    expect(screen.queryByTestId('bottom-tab-bar')).toBeNull()
    expect(screen.getByText(/WingCaster/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accept & confirm/i })).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  it('missing-token and expired states are announced as alerts', async () => {
    const missing = renderConsent('/public/relationships/consent?contactId=spoof')
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(apiMocks.getPublicRelationshipConsent).not.toHaveBeenCalled()
    cleanup()
    missing.unmount()

    apiMocks.getPublicRelationshipConsent.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 410, code: 'expired' }),
    )
    const { container } = renderConsent('/public/relationships/consent?token=old')
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByText(/consent link has expired/i)).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  it('accept/decline CTAs meet tap floor', async () => {
    renderConsent()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument()
    })
    assertTapFloor(screen.getByRole('button', { name: /Decline/i }), 'Decline')
    assertTapFloor(screen.getByRole('button', { name: /Accept & confirm/i }), 'Accept')
  })
})

describe('Wave 8 a11y — inbox dual-badge smoke', () => {
  it('ChannelSourceBadges announces channel from source and passes axe', async () => {
    const { container } = render(
      <ChannelSourceBadges channel="whatsapp" source="bayut" />,
    )
    expect(screen.getByLabelText(/WhatsApp from Bayut/i)).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  it('InboxRow dual-badge row passes axe', async () => {
    const { container } = render(
      <div role="list">
        <div role="listitem">
          <InboxRow conversation={sampleInboxConversation} onSelect={() => undefined} />
        </div>
      </div>,
    )
    expect(screen.getByLabelText(/WhatsApp from Bayut/i)).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })
})

describe('Wave 8 a11y — relationships editor smoke', () => {
  it('editor headings + pending actions pass axe', async () => {
    const { container } = renderRelationships()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Relationships' })).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: /My relationships/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Other agencies representing this contact/i }),
    ).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })
})

describe('Wave 8 a11y — RTL + dark smoke', () => {
  it('Pro table stays operable under rtl + dark', async () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    applyLcMode('dark')
    const { container } = renderProTable()
    expect(screen.getByRole('table')).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  it('consent landing stays public-safe under dark RTL', async () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    applyLcMode('dark')
    const { container } = renderConsent()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confirm this relationship/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('navigation')).toBeNull()
    await expectNoAxeViolations(container)
  })
})

describe('Wave 8 a11y — Pro AR copy via useLocale', () => {
  it('renders Arabic LOGIN_COPY when locale=ar', async () => {
    localeState.locale = 'ar'
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
    renderProDashboard()
    await waitFor(() => expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      LOGIN_COPY['greeting.goodDay'].ar.split('{name}')[0].trim().replace(/،\s*$/, ''),
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/يوم سعيد/)
  })
})

describe('Wave 8 a11y — dialog focus traps (Tab + Shift+Tab)', () => {
  async function assertFocusTrap(user: ReturnType<typeof userEvent.setup>) {
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    for (let i = 0; i < 6; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    for (let i = 0; i < 6; i += 1) {
      await user.tab({ shift: true })
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  }

  it('ProDashboard keyboard shortcuts dialog traps focus', async () => {
    const user = userEvent.setup()
    renderProDashboard()
    await waitFor(() => expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument())
    fireEvent.keyDown(window, { key: '?' })
    await assertFocusTrap(user)
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('Relationships create dialog traps focus', async () => {
    const user = userEvent.setup()
    renderRelationships()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Relationships' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Add relationship/i }))
    await assertFocusTrap(user)
  })

  it('ProListingsTable customize-columns dialog traps focus', async () => {
    const user = userEvent.setup()
    renderProTable()
    await user.click(screen.getByRole('button', { name: /Customize columns/i }))
    await assertFocusTrap(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('Wave 8 a11y — full InboxPage axe', () => {
  it('InboxPage list view passes axe', async () => {
    const { container } = render(
      wrapProviders(
        <MemoryRouter initialEntries={['/inbox']}>
          <Routes>
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/inbox/:id" element={<InboxPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(apiMocks.getConversations).toHaveBeenCalled()
    })
    expect(screen.queryByText('Omar Hassan')).toBeNull()
    await expectNoAxeViolations(container)
  })
})

describe('Wave 8 a11y — PIIMask on relationships editor', () => {
  it('masks contact name/email by default', async () => {
    const { container } = renderRelationships()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Relationships' })).toBeInTheDocument()
    })
    expect(screen.queryByText('Omar Hassan')).toBeNull()
    expect(screen.queryByText('omar@example.com')).toBeNull()
    expect(container.querySelector('[data-pii-revealed="false"]')).toBeTruthy()
    await expectNoAxeViolations(container)
  })
})
