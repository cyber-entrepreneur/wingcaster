// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { LIVE_SWITCH_CONFIRM_TOKEN, __resetEnvStoreForTests } from '@/hooks/useEnv'
import { LOCALE_STORAGE_KEY } from '@/hooks/useLocale'
import { ENV_SWITCHER_COPY } from '@/components/nav/EnvBadge'
import { SEARCH_COPY } from '@/components/nav/GlobalSearch'
import { resolvePersona } from '@/app/resolvePersona'
import { PersonaAppShell } from '@/app/PersonaAppShell'
import { AgentAppShell } from '@/app/AgentAppShell'
import { publishSessionEvent, SESSION_BROADCAST_CHANNEL } from '@/lib/broadcast'

const authMock = vi.hoisted(() => ({
  agent: null as null | Record<string, unknown>,
  loading: false,
  isAdmin: false,
  logout: vi.fn(),
  login: vi.fn(),
  completeTwoFactor: vi.fn(),
  register: vi.fn(),
  refreshAgent: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  clearElevatedToken: vi.fn(),
  api: {
    getConversations: vi.fn().mockResolvedValue([]),
    me: vi.fn(),
  },
}))

vi.mock('@/hooks/useUnreadConversationCount', () => ({
  useUnreadConversationCount: () => ({ count: 0, loading: false, refresh: vi.fn() }),
}))

vi.mock('@/hooks/useContactAttentionCount', () => ({
  useContactAttentionCount: () => ({ count: 0, loading: false, refresh: vi.fn() }),
}))

const tenantSwitch = vi.hoisted(() => vi.fn())
const tenantState = vi.hoisted(() => ({
  value: {
    tenants: [
      {
        id: 'personal:u1',
        name: 'Sara Agent',
        avatarUrl: null,
        role: 'owner' as const,
        kind: 'personal' as const,
        listingsCount: 1,
        agentsCount: 1,
      },
      {
        id: 'agency-elite',
        name: 'Elite Real Estate',
        avatarUrl: null,
        role: 'owner' as const,
        kind: 'agency' as const,
        listingsCount: 10,
        agentsCount: 4,
      },
    ],
    activeTenantId: 'personal:u1',
    activeTenant: {
      id: 'personal:u1',
      name: 'Sara Agent',
      avatarUrl: null,
      role: 'owner' as const,
      kind: 'personal' as const,
      listingsCount: 1,
      agentsCount: 1,
    },
    loading: false,
    switching: false,
    error: null as string | null,
    isMultiTenant: true,
    refresh: vi.fn(),
    switchTenant: tenantSwitch,
  },
}))

vi.mock('@/hooks/useTenant', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTenant')>('@/hooks/useTenant')
  return {
    ...actual,
    useTenant: () => tenantState.value,
  }
})

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
})

function installResizeObserver() {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
}

class MockBroadcastChannel {
  name: string
  static listeners = new Set<(event: MessageEvent) => void>()
  constructor(name: string) {
    this.name = name
  }
  postMessage(data: unknown) {
    const event = { data } as MessageEvent
    for (const listener of MockBroadcastChannel.listeners) listener(event)
  }
  addEventListener(_type: string, listener: EventListener) {
    MockBroadcastChannel.listeners.add(listener as (event: MessageEvent) => void)
  }
  removeEventListener(_type: string, listener: EventListener) {
    MockBroadcastChannel.listeners.delete(listener as (event: MessageEvent) => void)
  }
  close() {
    MockBroadcastChannel.listeners.clear()
  }
}

function signInAs(persona: 'agent' | 'agency' | 'pa') {
  if (persona === 'pa') {
    authMock.agent = {
      id: 'pa-1',
      name: 'Pat Admin',
      email: 'pa@wingcaster.test',
      platform_role: 'platform_admin',
      preferred_locale: 'en',
    }
    authMock.isAdmin = true
    return
  }
  if (persona === 'agency') {
    authMock.agent = {
      id: 'ag-1',
      name: 'Ada Agency',
      email: 'agency@wingcaster.test',
      role: 'admin',
      affiliation: { agency_id: 'a1', role: 'owner', agency_name: 'Elite' },
      preferred_locale: 'en',
    }
    authMock.isAdmin = false
    return
  }
  authMock.agent = {
    id: 'u-1',
    name: 'Sara Agent',
    email: 'sara@wingcaster.test',
    preferred_locale: 'en',
  }
  authMock.isAdmin = false
}

function wrap(ui: ReactElement, path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('resolvePersona', () => {
  it('maps platform_admin / isAdmin to pa, agency affiliation to agency, else agent', () => {
    expect(resolvePersona({ id: '1', platform_role: 'platform_admin' }, true)).toBe('pa')
    expect(
      resolvePersona({ id: '2', affiliation: { role: 'owner' } }),
    ).toBe('agency')
    expect(resolvePersona({ id: '3' })).toBe('agent')
    expect(resolvePersona(null)).toBeNull()
  })
})

describe('Wave 0 app shell integration', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    authMock.loading = false
    authMock.logout.mockReset()
    installResizeObserver()
    tenantSwitch.mockReset()
    tenantSwitch.mockImplementation(async (id: string) => {
      publishSessionEvent({ type: 'tenant-switched', tenantId: id })
      const next = tenantState.value.tenants.find((t) => t.id === id)!
      tenantState.value = {
        ...tenantState.value,
        activeTenantId: id,
        activeTenant: next,
      }
      return next
    })
    __resetEnvStoreForTests('live')
    MockBroadcastChannel.listeners.clear()
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: [], tenants: [] }),
        headers: { get: () => null },
        text: async () => '{}',
      }),
    )
    // Desktop-sized viewport by default
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('1024') || query.includes('min-width: 768'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    installResizeObserver()
  })

  it('sign-in → shell renders per persona', () => {
    signInAs('agent')
    const { unmount } = wrap(
      <PersonaAppShell>
        <div>Agent page</div>
      </PersonaAppShell>,
    )
    expect(screen.getByTestId('agent-app-shell')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByText('Skip to content')).toBeInTheDocument()
    unmount()

    signInAs('agency')
    const { unmount: u2 } = wrap(
      <PersonaAppShell>
        <div>Agency page</div>
      </PersonaAppShell>,
      '/agency',
    )
    expect(screen.getByTestId('agency-app-shell')).toBeInTheDocument()
    expect(screen.queryByTestId('agent-bottom-tab-bar')).not.toBeInTheDocument()
    u2()

    signInAs('pa')
    wrap(
      <PersonaAppShell>
        <div>PA page</div>
      </PersonaAppShell>,
      '/admin/fin/overview',
    )
    expect(screen.getByTestId('pa-app-shell')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Environment: LIVE/i })).toBeInTheDocument()
  })

  it('tenant switch fires BroadcastChannel tenant-switched', async () => {
    signInAs('agent')
    const received: unknown[] = []
    const channel = new BroadcastChannel(SESSION_BROADCAST_CHANNEL)
    channel.addEventListener('message', (event) => {
      received.push(event.data)
    })

    wrap(
      <PersonaAppShell viewport="desktop">
        <div>Page</div>
      </PersonaAppShell>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByTestId('tenant-switcher-trigger'))
    await user.click(await screen.findByRole('option', { name: /Elite Real Estate/i }))

    await waitFor(() => {
      expect(tenantSwitch).toHaveBeenCalledWith('agency-elite')
    })
    await waitFor(() => {
      expect(received.some((e) => (e as { type?: string }).type === 'tenant-switched')).toBe(true)
    })
  })

  it('locale switch persists html lang/dir', async () => {
    signInAs('agent')
    wrap(
      <PersonaAppShell>
        <div>Page</div>
      </PersonaAppShell>,
    )
    const user = userEvent.setup()
    // LanguageSelector aria-label is locale-aware English when current locale is en.
    const arabicRadios = screen.getAllByRole('radio', { name: /Arabic selected/i })
    await user.click(arabicRadios[0])

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('ar')
      expect(document.documentElement.dir).toBe('rtl')
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar')
    })
  })

  it('env switch LIVE-bound requires type-to-confirm', async () => {
    signInAs('pa')
    __resetEnvStoreForTests('test')
    wrap(
      <PersonaAppShell>
        <div>PA</div>
      </PersonaAppShell>,
      '/admin/fin/overview',
    )

    expect(screen.getByText(/You are in TEST environment/i)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Environment: TEST/i }))
    await user.click(await screen.findByRole('radio', { name: /LIVE/i }))

    const dialog = await screen.findByRole('alertdialog')
    const cta = within(dialog).getByRole('button', { name: ENV_SWITCHER_COPY['confirm.cta'].en })
    expect(cta).toBeDisabled()

    const checks = within(dialog).getAllByRole('checkbox')
    await user.click(checks[0])
    await user.click(checks[1])
    expect(cta).toBeDisabled()

    await user.type(
      within(dialog).getByLabelText(ENV_SWITCHER_COPY['confirm.type.label'].en),
      LIVE_SWITCH_CONFIRM_TOKEN,
    )
    expect(cta).not.toBeDisabled()
  })

  it('bottom tab bar hides when soft keyboard is visible', async () => {
    signInAs('agent')

    const listeners = new Map<string, Set<() => void>>()
    const vv = {
      height: 800,
      width: 375,
      addEventListener: (type: string, cb: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(cb)
      },
      removeEventListener: (type: string, cb: () => void) => {
        listeners.get(type)?.delete(cb)
      },
    }
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: vv,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 800,
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('max-width: 767'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })

    wrap(
      <AgentAppShell viewport="mobile">
        <div>Mobile</div>
      </AgentAppShell>,
    )

    expect(screen.getByTestId('agent-bottom-tab-bar')).toBeInTheDocument()

    await act(async () => {
      vv.height = 400
      listeners.get('resize')?.forEach((cb) => cb())
    })

    expect(screen.queryByTestId('agent-bottom-tab-bar')).not.toBeInTheDocument()
  })

  it('global search opens with Cmd+K / Ctrl+K', async () => {
    signInAs('agent')
    wrap(
      <PersonaAppShell>
        <div>Page</div>
      </PersonaAppShell>,
    )

    const user = userEvent.setup()
    await user.keyboard('{Control>}k{/Control}')

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(SEARCH_COPY.en.placeholder.agent),
      ).toBeInTheDocument()
    })
  })
})
