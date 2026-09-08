// @vitest-environment jsdom
/**
 * Wave 0 nav chrome — visual / DOM snapshot matrix (~80).
 *
 * Chromatic / Storybook are not configured in this repo. These Vitest
 * snapshots stand in for the §3.8 visual budget across LTR/RTL × light/dark
 * for key brief state variants. See scratchpad/wave0-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { TopBar } from '@/components/nav/TopBar'
import { SideDrawer } from '@/components/nav/SideDrawer'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { TenantSwitcher } from '@/components/nav/TenantSwitcher'
import { BottomTabBar } from '@/components/nav/BottomTabBar'
import { MoreSheet } from '@/components/nav/MoreSheet'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { EnvWarningStrip } from '@/components/nav/EnvWarningStrip'
import { EnvSwitchConfirmDialog } from '@/components/nav/EnvSwitchConfirmDialog'
import { EnvSwitcherPopover } from '@/components/nav/EnvSwitcherPopover'
import { GlobalSearch } from '@/components/nav/GlobalSearch'
import { UserMenu } from '@/components/nav/UserMenu'
import { NotificationsPopover } from '@/components/nav/NotificationsPopover'
import { LoginPage } from '@/pages/LoginPage'
import type { TenantSummary } from '@/hooks/useTenant'
import { AgentAppShell } from '@/app/AgentAppShell'
import { AgencyAppShell } from '@/app/AgencyAppShell'
import { PaAppShell } from '@/app/PaAppShell'

const { useTenantState, switchTenant } = vi.hoisted(() => {
  const switchTenantFn = vi.fn()
  return {
    switchTenant: switchTenantFn,
    useTenantState: {
      value: {
        tenants: [] as TenantSummary[],
        activeTenantId: null as string | null,
        activeTenant: null as TenantSummary | null,
        loading: false,
        switching: false,
        error: null as string | null,
        isMultiTenant: false,
        refresh: vi.fn(),
        switchTenant: switchTenantFn,
      },
    },
  }
})

vi.mock('@/hooks/useTenant', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTenant')>('@/hooks/useTenant')
  return {
    ...actual,
    useTenant: () => useTenantState.value,
  }
})

vi.mock('@/hooks/useUnreadConversationCount', () => ({
  useUnreadConversationCount: () => ({ count: 0, loading: false }),
}))
vi.mock('@/hooks/useContactAttentionCount', () => ({
  useContactAttentionCount: () => ({ count: 0, loading: false }),
}))
vi.mock('@/hooks/useVisualViewportKeyboardVisible', () => ({
  useVisualViewportKeyboardVisible: () => false,
}))

const authMock = vi.hoisted(() => ({
  agent: null as null | {
    id: string
    name?: string
    email?: string
    photo?: string | null
  },
  isAdmin: false,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  completeTwoFactor: vi.fn(),
  refreshAgent: vi.fn(),
}))

vi.mock('@/hooks/useEnv', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useEnv')>('@/hooks/useEnv')
  return {
    ...actual,
    useEnv: () => ({
      env: 'test' as const,
      isLive: false,
      isTest: true,
      switching: false,
      confirmLiveOpen: false,
      sessionChangedElsewhere: false,
      error: null,
      setEnv: vi.fn(),
      selectEnv: vi.fn(),
      requestSwitch: vi.fn(),
      confirmSwitchToLive: vi.fn(),
      openLiveConfirm: vi.fn(),
      closeLiveConfirm: vi.fn(),
      cancelConfirm: vi.fn(),
      refresh: vi.fn(),
    }),
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
  api: new Proxy(
    {},
    {
      get: () => vi.fn().mockResolvedValue({}),
    },
  ),
  clearElevatedToken: vi.fn(),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

const PERSONAL: TenantSummary = {
  id: 'personal:u1',
  name: 'Sara Almansoori',
  avatarUrl: null,
  role: 'owner',
  kind: 'personal',
  listingsCount: 3,
  agentsCount: 1,
}

const ELITE: TenantSummary = {
  id: 'agency-elite',
  name: 'Elite Real Estate',
  avatarUrl: null,
  role: 'owner',
  kind: 'agency',
  listingsCount: 47,
  agentsCount: 5,
  otherMembersCount: 4,
}

const DPC: TenantSummary = {
  id: 'agency-dpc',
  name: 'Dubai Properties Consortium',
  avatarUrl: null,
  role: 'member',
  kind: 'agency',
  listingsCount: 213,
  agentsCount: 23,
  otherMembersCount: 22,
}

const USER = { id: 'u-1', name: 'Sara Agent', email: 'sara@example.com' }

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(Element.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(Element.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn(() => false),
  })

  if (!document.getElementById('broadcast-theme-css')) {
    const style = document.createElement('style')
    style.id = 'broadcast-theme-css'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }

  class MockBroadcastChannel {
    name: string
    constructor(name: string) {
      this.name = name
    }
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  }
  vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
})

function setTenantHook(partial: Partial<typeof useTenantState.value>) {
  useTenantState.value = {
    tenants: [],
    activeTenantId: null,
    activeTenant: null,
    loading: false,
    switching: false,
    error: null,
    isMultiTenant: false,
    refresh: vi.fn(),
    switchTenant,
    ...partial,
  }
}

function wrap(ui: ReactNode, initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BrandProvider>
        <ToastProvider>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  {ui}
                  <main id="main-content">Content goes here</main>
                </>
              }
            />
          </Routes>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

/** Stabilize DOM for snapshots (ids, portals, absolute positions). */
function serialize(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[id]').forEach((el) => {
    const id = el.getAttribute('id') || ''
    if (id.startsWith('radix-') || id.includes(':') || /^r\d/.test(id)) {
      el.setAttribute('id', '__stable__')
    }
  })
  clone.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby], for').forEach((el) => {
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for'] as const) {
      if (el.hasAttribute(attr)) el.setAttribute(attr, '__stable__')
    }
  })
  clone.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || ''
    // Drop viewport-absolute placement noise from tenant popover.
    if (/top:|left:|right:/.test(style) && /fixed|absolute/.test(el.className) === false) {
      el.setAttribute(
        'style',
        style
          .replace(/top:[^;]+;?/g, '')
          .replace(/left:[^;]+;?/g, '')
          .replace(/right:[^;]+;?/g, '')
          .trim(),
      )
    }
    if (/top:\s*\d/.test(style) || /left:\s*\d/.test(style)) {
      el.setAttribute('style', '/* positioned */')
    }
  })
  // Include portal content (dialogs / popovers mounted on body).
  const portals = [...document.body.querySelectorAll('[data-radix-portal], [role="dialog"], [role="alertdialog"], [data-testid="tenant-switcher-popover"]')]
    .map((node) => {
      const c = node.cloneNode(true) as HTMLElement
      c.querySelectorAll('[id]').forEach((el) => el.setAttribute('id', '__stable__'))
      return c.outerHTML
    })
    .join('\n')
  const mode = document.documentElement.getAttribute('data-lc-mode') || 'light'
  const dir = document.documentElement.dir || 'ltr'
  const lang = document.documentElement.lang || 'en'
  return `<!-- mode=${mode} dir=${dir} lang=${lang} -->\n${clone.innerHTML}\n<!-- portals -->\n${portals}`
}

type Dir = 'ltr' | 'rtl'
type Mode = 'light' | 'dark'

const DIRS: Dir[] = ['ltr', 'rtl']
const MODES: Mode[] = ['light', 'dark']

type Fixture = {
  id: string
  path?: string
  setup?: () => void | Promise<void>
  render: () => ReactElement
  after?: () => void | Promise<void>
}

const FIXTURES: Fixture[] = [
  {
    id: 'topbar-agent-desktop',
    render: () => (
      <TopBar
        persona="agent"
        user={USER}
        viewport="desktop"
        languageSelector={<span data-slot="lang">EN</span>}
        tenantSwitcher={<span data-slot="tenant">Sara (personal)</span>}
      />
    ),
  },
  {
    id: 'topbar-agent-mobile',
    render: () => (
      <TopBar
        persona="agent"
        user={USER}
        viewport="mobile"
        languageSelector={<span data-slot="lang">EN</span>}
      />
    ),
  },
  {
    id: 'topbar-pa-test-env',
    path: '/admin/approvals',
    render: () => <TopBar persona="pa" user={USER} viewport="desktop" environment="test" />,
  },
  {
    id: 'topbar-pa-live-env',
    path: '/admin/approvals',
    render: () => <TopBar persona="pa" user={USER} viewport="desktop" environment="live" />,
  },
  {
    id: 'sidedrawer-agent-expanded',
    render: () => <SideDrawer persona="agent" mode="expanded" />,
  },
  {
    id: 'sidedrawer-agent-rail',
    render: () => <SideDrawer persona="agent" mode="rail" />,
  },
  {
    id: 'sidedrawer-agency',
    render: () => <SideDrawer persona="agency" mode="expanded" />,
  },
  {
    id: 'sidedrawer-pa',
    path: '/admin/approvals',
    render: () => <SideDrawer persona="pa" mode="expanded" badges={{ 'approvals-queue': 7 }} />,
  },
  {
    id: 'language-selector',
    setup: () => {
      localStorage.clear()
    },
    render: () => <LanguageSelector />,
  },
  {
    id: 'tenant-single',
    setup: () => {
      setTenantHook({
        tenants: [PERSONAL],
        activeTenantId: PERSONAL.id,
        activeTenant: PERSONAL,
        isMultiTenant: false,
      })
    },
    render: () => <TenantSwitcher forceMobile={false} />,
  },
  {
    id: 'tenant-multi-closed',
    setup: () => {
      setTenantHook({
        tenants: [PERSONAL, ELITE, DPC],
        activeTenantId: PERSONAL.id,
        activeTenant: PERSONAL,
        isMultiTenant: true,
      })
    },
    render: () => <TenantSwitcher forceMobile={false} />,
  },
  {
    id: 'tenant-multi-open',
    setup: async () => {
      setTenantHook({
        tenants: [PERSONAL, ELITE, DPC],
        activeTenantId: PERSONAL.id,
        activeTenant: PERSONAL,
        isMultiTenant: true,
      })
    },
    render: () => <TenantSwitcher forceMobile={false} />,
    after: async () => {
      const user = userEvent.setup()
      await user.click(screen.getByTestId('tenant-switcher-trigger'))
      await screen.findByTestId('tenant-switcher-popover')
    },
  },
  {
    id: 'tenant-mobile-sheet',
    setup: () => {
      setTenantHook({
        tenants: [PERSONAL, ELITE, DPC],
        activeTenantId: PERSONAL.id,
        activeTenant: PERSONAL,
        isMultiTenant: true,
      })
    },
    render: () => <TenantSwitcher forceMobile />,
    after: async () => {
      const user = userEvent.setup()
      await user.click(screen.getByTestId('tenant-switcher-trigger'))
      await screen.findByTestId('tenant-switcher-sheet')
    },
  },
  {
    id: 'bottom-tab-idle',
    path: '/dashboard',
    render: () => (
      <BottomTabBar forceMobile locale="en" inboxUnreadCount={0} contactsAttentionCount={0} />
    ),
  },
  {
    id: 'bottom-tab-badges',
    path: '/inbox',
    render: () => (
      <BottomTabBar
        forceMobile
        locale="en"
        inboxUnreadCount={12}
        contactsAttentionCount={3}
        moreAttention="MFA not enrolled"
      />
    ),
  },
  {
    id: 'bottom-tab-99plus',
    path: '/inbox',
    render: () => (
      <BottomTabBar forceMobile locale="en" inboxUnreadCount={120} contactsAttentionCount={0} />
    ),
  },
  {
    id: 'more-sheet-open',
    render: () => <MoreSheet open onOpenChange={() => {}} locale="en" showTeam />,
  },
  {
    id: 'env-badge-live',
    render: () => <EnvBadge env="live" />,
  },
  {
    id: 'env-badge-test',
    render: () => <EnvBadge env="test" />,
  },
  {
    id: 'env-warning-strip',
    render: () => <EnvWarningStrip onSwitchToLive={() => {}} />,
  },
]

// 20 fixtures × 2 dirs × 2 modes = 80 snapshots
expect(FIXTURES.length * DIRS.length * MODES.length).toBe(80)

describe('Wave 0 visual matrix — LTR/RTL × light/dark', () => {
  beforeEach(() => {
    localStorage.clear()
    authMock.agent = null
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    applyLcMode('light')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    // Clean leftover portals between cases
    document.body.querySelectorAll('[data-radix-portal]').forEach((n) => n.remove())
  })

  for (const fixture of FIXTURES) {
    for (const mode of MODES) {
      for (const dir of DIRS) {
        it(`${fixture.id} · ${mode} · ${dir}`, async () => {
          applyLcMode(mode)
          document.documentElement.dir = dir
          document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
          await fixture.setup?.()
          const view = wrap(fixture.render(), fixture.path ?? '/dashboard')
          await fixture.after?.()
          expect(serialize(view.container)).toMatchSnapshot()
          view.unmount()
        })
      }
    }
  }
})

describe('Wave 0 visual — additional open overlays (desktop)', () => {
  beforeEach(() => {
    applyLcMode('light')
    document.documentElement.dir = 'ltr'
    document.documentElement.lang = 'en'
  })

  it.each([
    ['light', 'ltr'],
    ['light', 'rtl'],
    ['dark', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('env confirm dialog · %s · %s', async (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    const view = wrap(
      <EnvSwitchConfirmDialog open onOpenChange={() => {}} onConfirm={() => {}} />,
    )
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('env popover open · %s · %s', async (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    const view = wrap(
      <EnvSwitcherPopover env="test" open onOpenChange={() => {}} onSelect={() => {}} />,
    )
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('global search open · %s · %s', async (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    const view = wrap(
      <GlobalSearch persona="agent" locale={dir === 'rtl' ? 'ar' : 'en'} open onOpenChange={() => {}} />,
    )
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('user menu open · %s · %s', async (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    const user = userEvent.setup()
    const view = wrap(<UserMenu user={USER} locale={dir === 'rtl' ? 'ar' : 'en'} />)
    await user.click(screen.getByLabelText('Sara Agent'))
    await screen.findByText(dir === 'rtl' ? 'تسجيل الخروج' : 'Sign out')
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('notifications open · %s · %s', async (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    const user = userEvent.setup()
    const view = wrap(
      <NotificationsPopover
        locale={dir === 'rtl' ? 'ar' : 'en'}
        notifications={[
          {
            id: '1',
            title: 'Hello',
            snippet: 'World',
            timestamp: '2026-01-01T00:00:00.000Z',
            unread: true,
          },
        ]}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Notifications|الإشعارات/i }))
    expect(serialize(view.container)).toMatchSnapshot()
  })

  it.each([
    ['light', 'ltr'],
    ['light', 'rtl'],
    ['dark', 'ltr'],
    ['dark', 'rtl'],
  ] as const)('login idle · %s · %s', async (mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const view = render(
      <MemoryRouter>
        <BrandProvider>
          <ToastProvider>
            <LoginPage />
          </ToastProvider>
        </BrandProvider>
      </MemoryRouter>,
    )
    expect(serialize(view.container)).toMatchSnapshot()
  })
})

describe('Wave 0 visual — viewport attribute smoke', () => {
  it('top bar tablet bucket differs from mobile brand compactness', () => {
    applyLcMode('light')
    const mobile = wrap(<TopBar persona="agent" user={USER} viewport="mobile" />)
    const mobileHtml = serialize(mobile.container)
    mobile.unmount()
    const tablet = wrap(<TopBar persona="agent" user={USER} viewport="tablet" />)
    const tabletHtml = serialize(tablet.container)
    // Compact mobile keeps aria-label="WingCaster" but drops the visible text node.
    const visibleWordmark = />WingCaster<\/span>/
    expect(visibleWordmark.test(mobileHtml)).toBe(false)
    expect(visibleWordmark.test(tabletHtml)).toBe(true)
    expect(tabletHtml).toMatchSnapshot()
  })
})

describe('Wave 0 visual — app shells (LTR/RTL × light/dark)', () => {
  beforeEach(() => {
    localStorage.clear()
    authMock.agent = {
      id: 'a1',
      name: 'Sara Agent',
      email: 'sara@example.com',
      photo: null,
    }
    authMock.isAdmin = false
    setTenantHook({
      tenants: [PERSONAL],
      activeTenantId: PERSONAL.id,
      activeTenant: PERSONAL,
      isMultiTenant: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  })

  it.each([
    ['agent-desktop', 'light', 'ltr'],
    ['agent-desktop', 'dark', 'rtl'],
    ['agent-mobile', 'light', 'rtl'],
    ['agent-mobile', 'dark', 'ltr'],
    ['agency-desktop', 'light', 'ltr'],
    ['agency-desktop', 'dark', 'rtl'],
    ['pa-desktop-test', 'light', 'ltr'],
    ['pa-desktop-test', 'dark', 'rtl'],
  ] as const)('shell %s · %s · %s', async (shell, mode, dir) => {
    applyLcMode(mode)
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    if (shell.startsWith('pa')) authMock.isAdmin = true

    let view
    if (shell === 'agent-desktop') {
      view = wrap(
        <AgentAppShell viewport="desktop">
          <p>Agent body</p>
        </AgentAppShell>,
      )
    } else if (shell === 'agent-mobile') {
      view = wrap(
        <AgentAppShell viewport="mobile">
          <p>Agent body</p>
        </AgentAppShell>,
      )
    } else if (shell === 'agency-desktop') {
      view = wrap(
        <AgencyAppShell viewport="desktop">
          <p>Agency body</p>
        </AgencyAppShell>,
      )
    } else {
      view = wrap(
        <PaAppShell viewport="desktop">
          <p>PA body</p>
        </PaAppShell>,
        '/admin/approvals',
      )
    }
    expect(serialize(view.container)).toMatchSnapshot()
  })
})
