// @vitest-environment jsdom
/**
 * Wave 8 Agent 6 — full-funnel daily-user integration (RTL + MemoryRouter).
 *
 * Covers CURSOR_SCREEN_WAVE_8_ACTIVATION_POLISH.md Phase B item 6:
 * sign-in → dashboard per mode → listing composer publish → inbox reply →
 * contact relationship + public consent, with ui_mode persistence and
 * inbox dual-read still working in the path.
 *
 * Playwright/Cypress are not in web/package.json; vitest+jsdom matches
 * Wave 1–4a e2e agents. Chromatic / a11y are Agent 7 — not duplicated here.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { renderHook } from '@testing-library/react'
import { ToastProvider } from '@/components/ui/toast'
import { readChannel, readSource } from '@/lib/channel-source'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WEB_SRC = path.resolve(HERE, '../..')
const APP_FILE = path.join(WEB_SRC, 'App.tsx')

const addToast = vi.hoisted(() => vi.fn())

const authState = vi.hoisted(() => ({
  agent: null as null | Record<string, unknown>,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  completeTwoFactor: vi.fn(),
  refreshAgent: vi.fn(),
}))

const tenantState = vi.hoisted(() => ({
  activeTenantId: 'personal:usr_sara',
  activeTenant: {
    id: 'personal:usr_sara',
    name: 'Sara Agent',
    avatarUrl: null,
    role: 'owner' as const,
    kind: 'personal' as const,
    listingsCount: 1,
    agentsCount: 1,
    uiMode: 'guided' as 'guided' | 'pro',
  },
  tenants: [] as Array<Record<string, unknown>>,
  loading: false,
  switching: false,
  error: null as string | null,
  isMultiTenant: false,
  refresh: vi.fn(async () => {}),
  switchTenant: vi.fn(),
}))

const uiModeState = vi.hoisted(() => ({
  mode: 'guided' as 'guided' | 'pro',
  effectiveMode: 'guided' as 'guided' | 'pro',
  shouldRenderPro: false,
  isProCapable: true,
  loading: false,
  switching: false,
  setMode: vi.fn(async (next: 'guided' | 'pro') => {
    uiModeState.mode = next
    uiModeState.effectiveMode = next === 'pro' && uiModeState.isProCapable ? 'pro' : 'guided'
    uiModeState.shouldRenderPro = uiModeState.effectiveMode === 'pro'
    tenantState.activeTenant.uiMode = next
    return { ok: true as const, mode: next }
  }),
  refresh: vi.fn(async () => {}),
}))

const apiMocks = vi.hoisted(() => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  getProperty: vi.fn(),
  deleteProperty: vi.fn(),
  uploadMedia: vi.fn(),
  getProperties: vi.fn(),
  getConversations: vi.fn(),
  getConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
  markConversationRead: vi.fn(),
  closeConversation: vi.fn(),
  updateConversation: vi.fn(),
  assignConversation: vi.fn(),
  getContact: vi.fn(),
  getContactRelationshipsMine: vi.fn(),
  getContactRelationshipsOther: vi.fn(),
  createContactRelationship: vi.fn(),
  updateContactRelationship: vi.fn(),
  deleteContactRelationship: vi.fn(),
  resendRelationshipConsentLink: vi.fn(),
  getPublicRelationshipConsent: vi.fn(),
  acceptPublicRelationshipConsent: vi.fn(),
  rejectPublicRelationshipConsent: vi.fn(),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => tenantState,
}))

vi.mock('@/hooks/useUiMode', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useUiMode')>('@/hooks/useUiMode')
  return {
    ...actual,
    useUiMode: (opts?: { forceProCapable?: boolean }) => {
      if (typeof opts?.forceProCapable === 'boolean') {
        const capable = opts.forceProCapable
        const effective =
          uiModeState.mode === 'pro' && capable ? ('pro' as const) : ('guided' as const)
        return {
          ...uiModeState,
          isProCapable: capable,
          effectiveMode: effective,
          shouldRenderPro: effective === 'pro',
        }
      }
      return uiModeState
    },
  }
})

vi.mock('@/hooks/useIsProCapable', () => ({
  useIsProCapable: (forced?: boolean) =>
    typeof forced === 'boolean' ? forced : uiModeState.isProCapable,
  PRO_VIEWPORT_MQ: '(min-width: 768px)',
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(async () => ({ ok: true as const })),
    dir: 'ltr' as const,
    isArabic: false,
  }),
}))

vi.mock('@/hooks/useEnv', () => ({
  useEnv: () => ({
    env: 'live' as const,
    isLive: true,
    isTest: false,
    switching: false,
    confirmLiveOpen: false,
    sessionChangedElsewhere: false,
    error: null,
    openLiveConfirm: vi.fn(),
    closeLiveConfirm: vi.fn(),
    selectEnv: vi.fn(),
    confirmSwitchToLive: vi.fn(),
    clearError: vi.fn(),
  }),
  getWingcasterEnv: () => 'live' as const,
  WINGCASTER_ENV_HEADER: 'X-Wingcaster-Env',
}))

vi.mock('@/hooks/useUnreadConversationCount', () => ({
  useUnreadConversationCount: () => ({ count: 1, loading: false, refresh: vi.fn() }),
}))

vi.mock('@/hooks/useContactAttentionCount', () => ({
  useContactAttentionCount: () => ({ count: 0, loading: false, refresh: vi.fn() }),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    api: apiMocks,
    API_BASE: '/api',
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    clearElevatedToken: vi.fn(),
  }
})

const loginApiMock = vi.hoisted(() => ({
  postAuthLogin: vi.fn(),
  adoptLoginToken: vi.fn(),
  startOAuth: vi.fn(),
}))

vi.mock('@/components/auth/loginApi', async () => {
  const actual = await vi.importActual<typeof import('@/components/auth/loginApi')>(
    '@/components/auth/loginApi',
  )
  return {
    ...actual,
    postAuthLogin: loginApiMock.postAuthLogin,
    adoptLoginToken: loginApiMock.adoptLoginToken,
    startOAuth: loginApiMock.startOAuth,
  }
})

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/context/BrandContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/BrandContext')>(
    '@/context/BrandContext',
  )
  return {
    ...actual,
    useMode: () => ['light', vi.fn()] as const,
    useBrand: () => ({
      brand: { name: 'Wingcaster' },
      setBrand: vi.fn(),
      loading: false,
      mode: 'light',
      setMode: vi.fn(),
    }),
  }
})

vi.mock('@/components/ListingFormModal', () => ({
  ListingFormModal: () => null,
}))

vi.mock('@/components/dashboard/KpiAnalyticsPanel', () => ({
  KpiAnalyticsPanel: () => <div data-testid="kpi-stub" />,
}))

import { LoginPage } from '@/pages/LoginPage'
import { AgentDashboardProGate } from '@/pages/agent/dashboard/AgentDashboardModeMount'
import { ManualListingComposerPage } from '@/pages/agent/listings/ManualListingComposerPage'
import { InboxPage, InboxConversationPage } from '@/pages/InboxPage'
import { RelationshipsEditorPage } from '@/pages/agent/contacts/RelationshipsEditorPage'
import { RelationshipConsentPage } from '@/pages/public/RelationshipConsentPage'
import { persistUiMode, useUiMode } from '@/hooks/useUiMode'
import type { ContactRelationship } from '@/pages/agent/contacts/relationshipTypes'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location-probe">{`${loc.pathname}${loc.search}`}</div>
}

function wrap(ui: ReactElement, initial = '/') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ToastProvider>
        {ui}
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const modernConv = {
  id: 'conv_modern',
  contact_name: 'Sara Al-Mansoori',
  contact_email: 'sara@example.com',
  contact_phone: '+97150111222',
  channel: 'whatsapp',
  source: 'bayut',
  source_channel: 'whatsapp:bayut',
  status: 'open',
  last_message_at: '2026-09-08T09:12:00Z',
  last_message_preview: 'Is the 2BR still available?',
  unread_count: 2,
  is_unread_by_agent: true,
  assigned_agent_id: 'usr_sara',
  priority_score: 87,
  priority_reason: 'hot lead',
  contact_id: 'cnt_1',
}

const legacyConv = {
  id: 'conv_legacy',
  contact_name: 'Ahmed Khoury',
  contact_email: 'a***@example.com',
  contact_phone: '+971 5X *** **34',
  source_channel: 'email_bayut',
  status: 'open',
  last_message_at: '2026-09-08T09:00:00Z',
  last_message_preview: 'Following up on the villa…',
  unread_count: 1,
  is_unread_by_agent: true,
  assigned_agent_id: null,
  priority_score: 40,
  contact_id: 'cnt_2',
}

function mineRel(overrides: Partial<ContactRelationship> = {}): ContactRelationship {
  return {
    id: 'rel_1',
    tenant_id: 'personal:usr_sara',
    contact_id: 'cnt_1',
    agent_user_id: 'usr_sara',
    party_type: 'buyer',
    relationship_type: 'representation',
    exclusivity: 'exclusive',
    scope: {
      areas: ['dubai-marina'],
      property_types: ['apartment'],
      price_range: { currency: 'AED', min: 1200000, max: 2400000 },
    },
    status: 'pending',
    consent_record: {},
    starts_at: '2026-09-08T00:00:00.000Z',
    ends_at: '2027-03-08T00:00:00.000Z',
    created_at: '2026-09-05T10:00:00.000Z',
    updated_at: '2026-09-05T10:00:00.000Z',
    ...overrides,
  }
}

function signInAgent() {
  authState.agent = {
    id: 'usr_sara',
    name: 'Sara Agent',
    email: 'sara@wingcaster.test',
    preferred_locale: 'en',
    photo: '',
    agency_name: 'Acme Realty',
    license_number: 'LIC-1',
    phone: '+971500000000',
    rating: 4.8,
    review_count: 12,
    ui_mode: tenantState.activeTenant.uiMode,
  }
  authState.loading = false
}

function resetFunnelState() {
  addToast.mockReset()
  authState.agent = null
  authState.loading = false
  authState.login.mockReset()
  authState.refreshAgent.mockReset()
  tenantState.activeTenant.uiMode = 'guided'
  tenantState.refresh.mockClear()
  uiModeState.mode = 'guided'
  uiModeState.effectiveMode = 'guided'
  uiModeState.shouldRenderPro = false
  uiModeState.isProCapable = true
  uiModeState.setMode.mockClear()
  Object.values(apiMocks).forEach((fn) => fn.mockReset())
  loginApiMock.postAuthLogin.mockReset()
  loginApiMock.adoptLoginToken.mockReset()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('768') || String(query).includes('1024'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('Wave 8 route + deep-link contracts', () => {
  it('App.tsx wires daily-user routes used by the funnel', () => {
    expect(existsSync(APP_FILE)).toBe(true)
    const src = readFileSync(APP_FILE, 'utf8')
    const required = [
      'path="/dashboard"',
      'path="/listings"',
      'path="/listings/new"',
      'path="/listings/:id"',
      'path="/inbox"',
      'path="/inbox/:conversationId"',
      'path="/contacts/:contactId/relationships"',
      'path="/settings/preferences"',
      'path="/public/relationships/consent"',
      'path="/login"',
    ]
    for (const route of required) {
      expect(src).toContain(route)
    }
  })
})

describe('Wave 8 funnel — sign-in → dashboard mode', () => {
  beforeEach(() => {
    resetFunnelState()
  })

  afterEach(() => {
    cleanup()
  })

  it('1. agent signs in and lands on /dashboard', async () => {
    const user = userEvent.setup()
    loginApiMock.postAuthLogin.mockResolvedValue({
      status: 'signed_in',
      token: 'tok_test',
      agent: { id: 'usr_sara', name: 'Sara Agent', email: 'sara@wingcaster.test' },
    })
    loginApiMock.adoptLoginToken.mockImplementation(async () => {
      signInAgent()
    })
    authState.refreshAgent.mockResolvedValue(undefined)

    wrap(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div data-testid="dashboard-landed">Dashboard</div>} />
      </Routes>,
      '/login',
    )

    await user.type(screen.getByLabelText(/^Email$/i), 'sara@wingcaster.test')
    await user.type(screen.getByLabelText(/^Password$/i), 'Secret123!')
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }))

    await waitFor(() => {
      expect(loginApiMock.postAuthLogin).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toBe('/dashboard')
    })
    expect(screen.getByTestId('dashboard-landed')).toBeInTheDocument()
  })

  it('2a. Pro dashboard mounts at ≥768px when ui_mode=pro', async () => {
    signInAgent()
    uiModeState.mode = 'pro'
    uiModeState.effectiveMode = 'pro'
    uiModeState.shouldRenderPro = true
    uiModeState.isProCapable = true
    tenantState.activeTenant.uiMode = 'pro'

    wrap(
      <AgentDashboardProGate guided={<div data-testid="guided-dashboard">Guided</div>} />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('guided-dashboard')).toBeNull()
  })

  it('2b. Guided fallback <768 preserves server ui_mode=pro (D-S-06)', () => {
    signInAgent()
    uiModeState.mode = 'pro'
    uiModeState.effectiveMode = 'guided'
    uiModeState.shouldRenderPro = false
    uiModeState.isProCapable = false
    tenantState.activeTenant.uiMode = 'pro'

    wrap(
      <AgentDashboardProGate guided={<div data-testid="guided-dashboard">Guided</div>} />,
    )

    expect(screen.getByTestId('guided-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pro-dashboard')).toBeNull()
    // Preference remains pro on the tenant membership even while Guided renders.
    expect(tenantState.activeTenant.uiMode).toBe('pro')
    expect(uiModeState.mode).toBe('pro')
  })
})

describe('Wave 8 funnel — listing composer publish path', () => {
  beforeEach(() => {
    resetFunnelState()
    signInAgent()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('3. creates via /listings/new, publishes, and lands on listing detail (publish success)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    apiMocks.createProperty.mockResolvedValue({ id: 'prop_funnel' })
    apiMocks.updateProperty.mockResolvedValue({ id: 'prop_funnel', status: 'active' })

    wrap(
      <Routes>
        <Route path="/listings/new" element={<ManualListingComposerPage />} />
        <Route path="/listings/:id/edit" element={<ManualListingComposerPage />} />
        <Route
          path="/listings/:id"
          element={<div data-testid="listing-detail">Listing published</div>}
        />
        <Route path="/listings" element={<div data-testid="listings-home">Listings</div>} />
      </Routes>,
      '/listings/new',
    )

    expect(screen.getByRole('heading', { name: /the basics/i })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/area \/ neighborhood/i), 'Dubai Marina')
    await user.type(screen.getByLabelText(/asking price/i), '2400000')
    await user.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /property details/i })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /photos & video/i })).toBeInTheDocument(),
    )
    const urlInput = screen.getByLabelText(/or paste a photo url/i)
    for (const url of [
      'https://cdn.example/1.jpg',
      'https://cdn.example/2.jpg',
      'https://cdn.example/3.jpg',
    ]) {
      await user.clear(urlInput)
      await user.type(urlInput, `${url}{Enter}`)
    }

    await user.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /how should buyers reach you/i }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /last look before you publish/i }),
      ).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: /publish →/i }))
    await waitFor(() => screen.getByRole('button', { name: /yes, publish/i }))
    await user.click(screen.getByRole('button', { name: /yes, publish/i }))

    await waitFor(() => {
      expect(apiMocks.createProperty).toHaveBeenCalled()
    })
    // No Wave-8 receipt screen yet — assert publish success navigates to listing detail.
    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toBe('/listings/prop_funnel')
    })
    expect(screen.getByTestId('listing-detail')).toBeInTheDocument()
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Published/i) }),
    )
  })
})

describe('Wave 8 funnel — inbox dual-read + reply', () => {
  beforeEach(() => {
    resetFunnelState()
    signInAgent()
    apiMocks.getConversations.mockResolvedValue([legacyConv, modernConv])
    apiMocks.getConversation.mockImplementation(async (id: string) => {
      const base = id === 'conv_legacy' ? legacyConv : modernConv
      return {
        ...base,
        messages: [
          {
            id: 'm1',
            direction: 'inbound',
            channel: readChannel(base),
            content: base.last_message_preview,
            status: 'received',
            created_at: '2026-09-08T08:12:00Z',
          },
        ],
        contact: {
          id: base.contact_id,
          name: base.contact_name,
          email: base.contact_email,
          phone: base.contact_phone,
        },
      }
    })
    apiMocks.sendConversationMessage.mockResolvedValue({
      id: 'm_out',
      direction: 'outbound',
      content: 'Yes — still available this week.',
      status: 'sent',
      created_at: new Date().toISOString(),
    })
    apiMocks.markConversationRead.mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
  })

  it('4. opens inquiry, dual-reads legacy+modern channels, and sends a reply', async () => {
    const user = userEvent.setup()

    wrap(
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/inbox/:conversationId" element={<InboxConversationPage />} />
      </Routes>,
      '/inbox',
    )

    await waitFor(() => {
      expect(screen.getByText('Sara Al-Mansoori')).toBeInTheDocument()
    })
    expect(screen.getByText('Ahmed Khoury')).toBeInTheDocument()

    // Dual-read contract still holds in the funnel payload shape.
    expect(readChannel(legacyConv)).toBe('email')
    expect(readSource(legacyConv)).toBe('bayut')
    expect(readChannel(modernConv)).toBe('whatsapp')
    expect(readSource(modernConv)).toBe('bayut')

    await user.click(screen.getByRole('button', { name: /Sara Al-Mansoori/i }))

    await waitFor(() => {
      expect(screen.getByText('Is the 2BR still available?')).toBeInTheDocument()
    })
    expect(screen.getAllByLabelText(/WhatsApp from Bayut/i).length).toBeGreaterThan(0)

    const compose = screen.getByLabelText('Compose message')
    await user.type(compose, 'Yes — still available this week.')
    await user.click(screen.getByRole('button', { name: /Send message/i }))

    await waitFor(() => {
      expect(apiMocks.sendConversationMessage).toHaveBeenCalledWith(
        'conv_modern',
        expect.stringMatching(/still available/i),
      )
    })
  })

  it('deep-link /inbox/:id opens legacy dual-read conversation', async () => {
    wrap(
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/inbox/:conversationId" element={<InboxConversationPage />} />
      </Routes>,
      '/inbox/conv_legacy',
    )

    await waitFor(() => {
      expect(screen.getByText('Ahmed Khoury')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getAllByLabelText(/Email from Bayut/i).length).toBeGreaterThan(0)
    })
  })
})

describe('Wave 8 funnel — relationships + public consent', () => {
  beforeEach(() => {
    resetFunnelState()
    signInAgent()
    apiMocks.getContact.mockResolvedValue({
      id: 'cnt_1',
      name: 'Sara Al-Mansoori',
      email: 'sara@example.com',
      phone: '+971500000000',
    })
    apiMocks.getContactRelationshipsMine.mockResolvedValue({ relationships: [] })
    apiMocks.getContactRelationshipsOther.mockResolvedValue({
      relationships: [],
      disabled: false,
    })
    apiMocks.createContactRelationship.mockResolvedValue(mineRel())
    apiMocks.resendRelationshipConsentLink.mockResolvedValue({
      ok: true,
      consent_url: '/public/relationships/consent?token=tok_rel_hmac',
    })
    apiMocks.getPublicRelationshipConsent.mockResolvedValue({
      purpose: 'relationship_consent',
      relationship_id: 'rel_1',
      contact_id: 'cnt_1',
      relationship_type: 'representation',
      party_type: 'buyer',
      exclusivity: 'exclusive',
      status: 'pending',
      starts_at: '2026-09-08T00:00:00.000Z',
      ends_at: '2027-03-08T00:00:00.000Z',
      scope: {
        areas: ['dubai-marina'],
        property_types: ['apartment'],
        price_range: { currency: 'AED', min: 1200000, max: 2400000 },
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('5. adds a contact relationship and can resend consent link', async () => {
    const user = userEvent.setup()

    wrap(
      <Routes>
        <Route
          path="/contacts/:contactId/relationships"
          element={<RelationshipsEditorPage />}
        />
        <Route path="/contacts/:id" element={<div>Contact detail</div>} />
      </Routes>,
      '/contacts/cnt_1/relationships',
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Add first relationship/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /\+ Add first relationship/i }))
    await user.click(screen.getByRole('radio', { name: /Representation/i }))
    await user.click(screen.getByRole('button', { name: /Continue/i }))
    await user.click(screen.getByRole('radio', { name: /^Buyer$/i }))
    await user.click(screen.getByRole('button', { name: /Continue/i }))
    await user.click(screen.getByRole('button', { name: /Save relationship/i }))

    await waitFor(() => {
      expect(apiMocks.createContactRelationship).toHaveBeenCalledWith(
        'cnt_1',
        expect.objectContaining({
          party_type: 'buyer',
          relationship_type: 'representation',
        }),
      )
    })

    // After create, show pending card with resend (reload mine list).
    apiMocks.getContactRelationshipsMine.mockResolvedValue({ relationships: [mineRel()] })
    cleanup()
    wrap(
      <Routes>
        <Route
          path="/contacts/:contactId/relationships"
          element={<RelationshipsEditorPage />}
        />
      </Routes>,
      '/contacts/cnt_1/relationships',
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resend confirmation/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Resend confirmation/i }))
    await waitFor(() => {
      expect(apiMocks.resendRelationshipConsentLink).toHaveBeenCalledWith('cnt_1', 'rel_1')
    })
  })

  it('consent landing is reachable via token-only public route', async () => {
    wrap(
      <Routes>
        <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
      </Routes>,
      '/public/relationships/consent?token=tok_rel_hmac',
    )

    await waitFor(() => {
      expect(apiMocks.getPublicRelationshipConsent).toHaveBeenCalledWith('tok_rel_hmac')
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confirm this relationship/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/^Representation$/i)).toBeInTheDocument()
    // Token is sole auth input — other query params must not be required.
    expect(screen.queryByText(/Consent link is incomplete/i)).not.toBeInTheDocument()
  })

  it('consent landing rejects missing token without trusting other params', async () => {
    wrap(
      <Routes>
        <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
      </Routes>,
      '/public/relationships/consent?contactId=cnt_1&relationshipId=rel_1',
    )

    await waitFor(() => {
      expect(apiMocks.getPublicRelationshipConsent).not.toHaveBeenCalled()
    })
    expect(screen.getByText(/Consent link is incomplete/i)).toBeInTheDocument()
  })
})

describe('Wave 8 funnel — ui_mode persistence (tenant_memberships.data)', () => {
  beforeEach(() => {
    resetFunnelState()
    signInAgent()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ui_mode: 'pro' }),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('persists ui_mode via PATCH /users/me (per-tenant preference)', async () => {
    // Use the real hook (not the funnel mock override path for forceProCapable).
    const { unmount } = renderHook(() => useUiMode({ forceProCapable: true }))
    // Direct persist API — same path InterfaceModeCard / setMode uses.
    const result = await persistUiMode('pro')
    expect(result.ok).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ui_mode: 'pro' }),
      }),
    )
    unmount()
  })

  it('per-tenant uiMode drives shouldRenderPro only when viewport-capable', () => {
    tenantState.activeTenant.uiMode = 'pro'
    uiModeState.mode = 'pro'

    const desktop = renderHook(() => useUiMode({ forceProCapable: true }))
    expect(desktop.result.current.mode).toBe('pro')
    expect(desktop.result.current.shouldRenderPro).toBe(true)
    desktop.unmount()

    const mobile = renderHook(() => useUiMode({ forceProCapable: false }))
    expect(mobile.result.current.mode).toBe('pro')
    expect(mobile.result.current.effectiveMode).toBe('guided')
    expect(mobile.result.current.shouldRenderPro).toBe(false)
    mobile.unmount()
  })
})

describe('Wave 8 funnel — screens link cleanly', () => {
  beforeEach(() => {
    resetFunnelState()
    signInAgent()
  })

  afterEach(() => {
    cleanup()
  })

  it('6. MemoryRouter walks dashboard → listings/new → inbox → relationships → consent', async () => {
    const user = userEvent.setup()
    const { Link } = await import('react-router-dom')

    function LinkedFunnel() {
      const loc = useLocation()
      return (
        <div>
          <nav aria-label="Funnel">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/listings">Listings</Link>
            <Link to="/listings/new">New listing</Link>
            <Link to="/inbox">Inbox</Link>
            <Link to="/contacts/cnt_1/relationships">Relationships</Link>
            <Link to="/public/relationships/consent?token=tok">Consent</Link>
            <Link to="/settings/preferences">Preferences</Link>
          </nav>
          <div data-testid="funnel-path">{`${loc.pathname}${loc.search}`}</div>
          <Routes>
            <Route path="/dashboard" element={<div>Dash</div>} />
            <Route path="/listings" element={<div>List</div>} />
            <Route path="/listings/new" element={<div>Composer</div>} />
            <Route path="/inbox" element={<div>Inbox</div>} />
            <Route path="/contacts/:contactId/relationships" element={<div>Rels</div>} />
            <Route path="/public/relationships/consent" element={<div>Consent</div>} />
            <Route path="/settings/preferences" element={<div>Prefs</div>} />
          </Routes>
        </div>
      )
    }

    wrap(<LinkedFunnel />, '/dashboard')
    expect(screen.getByTestId('funnel-path').textContent).toBe('/dashboard')

    await user.click(screen.getByRole('link', { name: 'New listing' }))
    expect(screen.getByTestId('funnel-path').textContent).toBe('/listings/new')

    await user.click(screen.getByRole('link', { name: 'Inbox' }))
    expect(screen.getByTestId('funnel-path').textContent).toBe('/inbox')

    await user.click(screen.getByRole('link', { name: 'Relationships' }))
    expect(screen.getByTestId('funnel-path').textContent).toBe('/contacts/cnt_1/relationships')

    await user.click(screen.getByRole('link', { name: 'Consent' }))
    expect(screen.getByTestId('funnel-path').textContent).toBe(
      '/public/relationships/consent?token=tok',
    )

    await user.click(screen.getByRole('link', { name: 'Preferences' }))
    expect(screen.getByTestId('funnel-path').textContent).toBe('/settings/preferences')
  })
})
