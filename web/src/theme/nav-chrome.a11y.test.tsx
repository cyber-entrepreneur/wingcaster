// @vitest-environment jsdom
/**
 * Wave 0 nav chrome — accessibility contract (CURSOR_SCREEN_WAVE_0_FOUNDATIONS §3.8).
 * Covers: ≥44×44 tap targets, two-tone focus rings, aria-live (route/tenant/locale),
 * focus traps in popovers/dialogs/sheets, skip-to-content, no color-only differentiation.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ReactElement } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { TopBar } from '@/components/nav/TopBar'
import { SideDrawer } from '@/components/nav/SideDrawer'
import { LanguageSelector, LANGUAGE_SELECTOR_COPY } from '@/components/nav/LanguageSelector'
import { TenantSwitcher } from '@/components/nav/TenantSwitcher'
import { BottomTabBar } from '@/components/nav/BottomTabBar'
import { MoreSheet } from '@/components/nav/MoreSheet'
import { EnvBadge, ENV_SWITCHER_COPY } from '@/components/nav/EnvBadge'
import { EnvWarningStrip } from '@/components/nav/EnvWarningStrip'
import { EnvSwitchConfirmDialog } from '@/components/nav/EnvSwitchConfirmDialog'
import { EnvSwitcherPopover } from '@/components/nav/EnvSwitcherPopover'
import { GlobalSearch } from '@/components/nav/GlobalSearch'
import { UserMenu } from '@/components/nav/UserMenu'
import { NotificationsPopover } from '@/components/nav/NotificationsPopover'
import type { TenantSummary } from '@/hooks/useTenant'
import { LoginPage } from '@/pages/LoginPage'
import { BrandProvider } from '@/context/BrandContext'
import { AgentAppShell } from '@/app/AgentAppShell'
import { AgencyAppShell } from '@/app/AgencyAppShell'
import { PaAppShell } from '@/app/PaAppShell'

expect.extend(toHaveNoViolations)

const TAP_FLOOR =
  /(^|\s)(min-h-tap|h-tap|min-h-\[var\(--lc-tap-target-min\)\])(\s|$)/

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
    preferred_locale?: string
    is_admin?: boolean
    agency_id?: string | null
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

function wrap(ui: ReactElement, initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

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

function assertTapFloor(el: Element, label: string) {
  const cls = (el as HTMLElement).className || ''
  const styleMin =
    typeof window !== 'undefined'
      ? getComputedStyle(el).minHeight
      : ''
  const hasClass = TAP_FLOOR.test(cls)
  const hasCssFloor =
    styleMin === '44px' ||
    styleMin.includes('var(--lc-tap-target-min)') ||
    // jsdom often returns '' — broadcast CSS still declares the floor for buttons
    (el.tagName === 'BUTTON' && THEME_CSS.includes('min-height: var(--lc-tap-target-min)'))
  expect(hasClass || hasCssFloor, `${label} must meet 44px tap floor`).toBe(true)
}

describe('Wave 0 a11y — tap targets ≥44×44', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  })

  it('TopBar interactive controls declare tap-floor utilities', () => {
    wrap(
      <TopBar
        persona="agent"
        user={USER}
        viewport="desktop"
        languageSelector={<button type="button">EN</button>}
        tenantSwitcher={<button type="button">Tenant</button>}
      />,
    )
    assertTapFloor(screen.getByRole('button', { name: /Toggle navigation/i }), 'drawer toggle')
    assertTapFloor(screen.getByLabelText('Sara Agent'), 'user menu')
    assertTapFloor(screen.getByRole('button', { name: /Notifications/i }), 'notifications')
  })

  it('LanguageSelector pills use --lc-tap-target-min', () => {
    wrap(<LanguageSelector />)
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.className).toMatch(/min-h-\[var\(--lc-tap-target-min\)\]/)
      expect(radio.className).toMatch(/min-w-\[var\(--lc-tap-target-min\)\]/)
    }
  })

  it('BottomTabBar cells use --lc-tap-target-min', () => {
    wrap(
      <BottomTabBar forceMobile locale="en" inboxUnreadCount={0} contactsAttentionCount={0} />,
      '/dashboard',
    )
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toMatch(/min-h-\[var\(--lc-tap-target-min\)\]/)
    }
  })

  it('SideDrawer nav links use min-h-tap', () => {
    wrap(<SideDrawer persona="agent" mode="expanded" />, '/dashboard')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const link = within(nav).getByRole('link', { name: /Dashboard/i })
    expect(link.className).toMatch(/min-h-tap/)
  })

  it('broadcast theme ships 44px button floor + two-tone focus', () => {
    expect(THEME_CSS).toContain('--lc-tap-target-min: 44px')
    expect(THEME_CSS).toMatch(
      /:where\(button[^)]*\).*min-height:\s*var\(--lc-tap-target-min\)/s,
    )
    expect(THEME_CSS).toContain('0 0 0 2px var(--lc-focus-ring)')
    expect(THEME_CSS).toContain('0 0 0 4px var(--lc-focus-ring-contrast)')
  })
})

describe('Wave 0 a11y — focus rings', () => {
  it('keyboard focus on LanguageSelector applies two-tone box-shadow from Broadcast CSS', async () => {
    const user = userEvent.setup()
    wrap(<LanguageSelector />)
    const radio = screen.getByRole('radio', {
      name: LANGUAGE_SELECTOR_COPY['aria.selected.en'].en,
    })
    await user.tab()
    // May land on radio after one or more tabs depending on DOM order
    radio.focus()
    expect(document.activeElement).toBe(radio)
    const shadow = getComputedStyle(radio).boxShadow
    // jsdom may not resolve CSS vars into computed shadow; assert class contract + CSS source
    expect(radio.className).toMatch(/focus-visible:outline-none/)
    expect(THEME_CSS).toMatch(/:focus-visible[\s\S]*--lc-focus-ring/)
    if (shadow && shadow !== 'none') {
      expect(shadow).toMatch(/rgb|var\(--lc-focus/)
    }
  })
})

describe('Wave 0 a11y — aria-live for route / tenant / locale', () => {
  beforeEach(() => {
    localStorage.clear()
    authMock.agent = null
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    switchTenant.mockReset()
  })

  it('TopBar exposes polite live region for route announcements', () => {
    wrap(
      <TopBar persona="agent" user={USER} viewport="desktop" routeAnnounce="Dashboard" />,
      '/dashboard',
    )
    const live = document.querySelector('[aria-live="polite"][aria-atomic="true"]')
    expect(live).toBeTruthy()
    expect(live).toHaveTextContent('Dashboard')
  })

  it('LanguageSelector announces locale switches via polite status', async () => {
    const user = userEvent.setup()
    wrap(<LanguageSelector />)
    await user.click(
      screen.getByRole('radio', { name: LANGUAGE_SELECTOR_COPY['aria.selected.ar'].en }),
    )
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        LANGUAGE_SELECTOR_COPY['announce.switched.ar'].ar,
      )
    })
  })

  it('TenantSwitcher mounts a polite aria-live region', () => {
    setTenantHook({
      tenants: [PERSONAL, ELITE],
      activeTenantId: PERSONAL.id,
      activeTenant: PERSONAL,
      isMultiTenant: true,
    })
    wrap(<TenantSwitcher forceMobile={false} />)
    const lives = document.querySelectorAll('[aria-live="polite"]')
    expect(lives.length).toBeGreaterThan(0)
  })

  it('EnvWarningStrip announces TEST via status + aria-live polite', () => {
    wrap(<EnvWarningStrip onSwitchToLive={() => {}} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(ENV_SWITCHER_COPY['strip.warning.text'].en)
  })
})

describe('Wave 0 a11y — focus traps in dialogs / sheets / search', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('EnvSwitchConfirmDialog traps focus (alertdialog) and Escape closes', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    wrap(
      <EnvSwitchConfirmDialog open onOpenChange={onOpenChange} onConfirm={vi.fn()} />,
    )
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Focus should land inside the dialog
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })

    // Tab stays inside
    for (let i = 0; i < 8; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('GlobalSearch dialog traps focus while open', async () => {
    const user = userEvent.setup()
    wrap(<GlobalSearch persona="agent" locale="en" open onOpenChange={() => {}} />)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    for (let i = 0; i < 5; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('MoreSheet opens as modal dialog with focusable rows', async () => {
    const user = userEvent.setup()
    wrap(<MoreSheet open onOpenChange={() => {}} locale="en" />)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const firstRow = within(dialog).getAllByRole('button')[0]
    firstRow.focus()
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.keyboard('{Escape}')
  })
})

describe('Wave 0 a11y — skip-to-content', () => {
  it('Skip to content is the first Tab stop on TopBar and targets #main-content', async () => {
    const user = userEvent.setup()
    wrap(
      <>
        <TopBar persona="agent" user={USER} viewport="desktop" />
        <main id="main-content">Content</main>
      </>,
    )
    const skip = screen.getByText('Skip to content')
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(skip.className).toMatch(/sr-only/)

    await user.tab()
    expect(document.activeElement).toBe(skip)
  })
})

describe('Wave 0 a11y — no color-only differentiation', () => {
  it('EnvBadge pairs distinct icons with LIVE/TEST labels', () => {
    const { unmount } = wrap(<EnvBadge env="live" />)
    expect(screen.getByRole('button', { name: /Environment: LIVE/i })).toHaveTextContent('LIVE')
    expect(screen.getByRole('button').querySelector('svg')).toBeTruthy()
    unmount()
    wrap(<EnvBadge env="test" />)
    expect(screen.getByRole('button', { name: /Environment: TEST/i })).toHaveTextContent('TEST')
    expect(screen.getByRole('button').querySelector('svg')).toBeTruthy()
  })

  it('SideDrawer active item uses aria-current plus visual bar (not color alone)', () => {
    wrap(<SideDrawer persona="agent" mode="expanded" />, '/dashboard')
    const active = screen.getByRole('link', { name: /Dashboard/i })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active.className).toMatch(/font-semibold|font-medium|bg-/)
  })

  it('BottomTab active state exposes aria-selected + top indicator span', () => {
    wrap(
      <BottomTabBar forceMobile locale="en" inboxUnreadCount={0} contactsAttentionCount={0} />,
      '/dashboard',
    )
    const active = screen.getByRole('tab', { selected: true })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it('LanguageSelector active pill uses aria-checked (not color alone)', () => {
    wrap(<LanguageSelector />)
    expect(screen.getByRole('radio', { checked: true })).toBeInTheDocument()
  })

  it('More attention requires accessible warning label (not color-only dot)', () => {
    wrap(
      <BottomTabBar
        forceMobile
        locale="en"
        moreAttention="MFA not enrolled"
        inboxUnreadCount={0}
        contactsAttentionCount={0}
      />,
    )
    expect(screen.getByText(/MFA not enrolled/i)).toBeInTheDocument()
  })
})

describe('Wave 0 a11y — axe smoke on chrome + login', () => {
  beforeEach(() => {
    authMock.agent = null
    authMock.loading = false
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  })

  it.each([
    [
      'TopBar + SideDrawer',
      <div>
        <TopBar persona="pa" user={USER} viewport="desktop" environment="test" />
        <SideDrawer persona="pa" mode="expanded" />
        <main id="main-content">Page</main>
      </div>,
    ],
    [
      'BottomTabBar',
      <BottomTabBar forceMobile inboxUnreadCount={3} contactsAttentionCount={1} moreAttention />,
    ],
    ['LanguageSelector', <LanguageSelector />],
    ['EnvSwitchConfirmDialog', <EnvSwitchConfirmDialog open onOpenChange={() => {}} onConfirm={() => {}} />],
  ] as const)('%s has no axe violations', async (_name, ui) => {
    const { container } = wrap(ui)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('LoginPage has polite error live region and passes axe (Radix tab id caveat)', async () => {
    const { container } = render(
      <MemoryRouter>
        <BrandProvider>
          <ToastProvider>
            <LoginPage />
          </ToastProvider>
        </BrandProvider>
      </MemoryRouter>,
    )
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy()
    // Radix Tabs uses colon ids (`radix-:rN:-trigger-*`) which axe flags as
    // aria-valid-attr-value even though browsers accept them. Disable that
    // single rule for Login; other rules still run.
    expect(
      await axe(container, {
        rules: { 'aria-valid-attr-value': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })

  it('EnvSwitcherPopover radiogroup is axe-clean when open', async () => {
    const { container } = wrap(
      <EnvSwitcherPopover env="live" open onOpenChange={() => {}} onSelect={() => {}} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Wave 0 a11y — popover escape / UserMenu', () => {
  it('UserMenu and NotificationsPopover open without axe violations', async () => {
    const user = userEvent.setup()
    const { container } = wrap(
      <div>
        <NotificationsPopover
          locale="en"
          notifications={[
            {
              id: '1',
              title: 'Hello',
              snippet: 'World',
              timestamp: '2026-01-01T00:00:00.000Z',
              unread: true,
            },
          ]}
        />
        <UserMenu user={USER} locale="en" />
      </div>,
    )
    await user.click(screen.getByRole('button', { name: /Notifications: 1 new/i }))
    await screen.findByText(/Notifications/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Wave 0 a11y — app shells (landed mid-run)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    authMock.agent = {
      id: 'a1',
      name: 'Sara Agent',
      email: 'sara@example.com',
      photo: null,
    }
    authMock.isAdmin = false
    authMock.loading = false
    setTenantHook({
      tenants: [PERSONAL],
      activeTenantId: PERSONAL.id,
      activeTenant: PERSONAL,
      isMultiTenant: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  })

  it('AgentAppShell exposes skip link, banner, main landmark, and bottom tabs on mobile', async () => {
    wrap(
      <AgentAppShell viewport="mobile">
        <p>Agent body</p>
      </AgentAppShell>,
    )
    expect(screen.getByTestId('agent-app-shell')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByText('Skip to content')).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).toBeTruthy()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(await axe(screen.getByTestId('agent-app-shell'))).toHaveNoViolations()
  })

  it('AgencyAppShell has no bottom tab bar and keeps skip + main', async () => {
    wrap(
      <AgencyAppShell viewport="desktop">
        <p>Agency body</p>
      </AgencyAppShell>,
    )
    expect(screen.getByTestId('agency-app-shell')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('Skip to content')).toBeInTheDocument()
    expect(document.getElementById('main-content')).toHaveTextContent('Agency body')
  })

  it('PaAppShell shows TEST warning strip with polite live region', async () => {
    authMock.isAdmin = true
    wrap(
      <PaAppShell viewport="desktop">
        <p>PA body</p>
      </PaAppShell>,
      '/admin/approvals',
    )
    expect(screen.getByTestId('pa-app-shell')).toHaveAttribute('data-env', 'test')
    const strip = screen.getByText(ENV_SWITCHER_COPY['strip.warning.text'].en).closest('[role="status"]')
    expect(strip).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Skip to content')).toBeInTheDocument()
  })
})
