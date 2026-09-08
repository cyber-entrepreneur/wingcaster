// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { TopBar } from '../TopBar'
import { SideDrawer } from '../SideDrawer'
import { GlobalSearch, SEARCH_COPY } from '../GlobalSearch'
import { UserMenu, USER_MENU_COPY } from '../UserMenu'
import { NotificationsPopover, NOTIFICATIONS_COPY } from '../NotificationsPopover'

const user = {
  id: 'u-1',
  name: 'Sara Agent',
  email: 'sara@example.com',
}

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
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

describe('TopBar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders banner, skip link, search, notifications, and user menu', () => {
    wrap(
      <TopBar
        persona="agent"
        user={user}
        viewport="desktop"
        notifications={[
          {
            id: '1',
            title: 'Hello',
            snippet: 'World',
            timestamp: new Date().toISOString(),
            unread: true,
          },
        ]}
        tenantSwitcher={<button type="button">Elite Real Estate</button>}
        languageSelector={<button type="button">EN</button>}
      />,
    )
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByText('Skip to content')).toBeInTheDocument()
    expect(screen.getByText('WingCaster')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Elite Real Estate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^EN$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Notifications: 1 new/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Sara Agent')).toBeInTheDocument()
  })

  it('shows LIVE/TEST env badge only for PA persona', () => {
    const { unmount } = wrap(
      <TopBar persona="agent" user={user} viewport="desktop" environment="test" />,
    )
    expect(screen.queryByRole('button', { name: /Environment: TEST/i })).not.toBeInTheDocument()
    unmount()
    wrap(<TopBar persona="pa" user={user} viewport="desktop" environment="test" />, '/admin/approvals')
    expect(screen.getByRole('button', { name: /Environment: TEST/i })).toBeInTheDocument()
  })

  it('accepts tenantSwitcher and languageSelector slots', () => {
    wrap(
      <TopBar
        persona="agency"
        user={user}
        viewport="desktop"
        tenantSwitcher={<div data-testid="tenant-slot">Tenant</div>}
        languageSelector={<div data-testid="lang-slot">Lang</div>}
      />,
    )
    expect(screen.getByTestId('tenant-slot')).toBeInTheDocument()
    expect(screen.getByTestId('lang-slot')).toBeInTheDocument()
  })
})

describe('SideDrawer', () => {
  it('highlights the active nav item from the route', () => {
    wrap(<SideDrawer persona="agent" mode="expanded" />, '/dashboard')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const active = within(nav).getByRole('link', { name: /Dashboard/i })
    expect(active).toHaveAttribute('aria-current', 'page')
  })

  it('renders PA groups and approvals badge when provided', () => {
    wrap(
      <SideDrawer persona="pa" mode="expanded" badges={{ 'approvals-queue': 7 }} />,
      '/admin/approvals',
    )
    expect(screen.getByText('Approvals')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Approvals queue/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders Arabic group labels in ar locale', () => {
    wrap(<SideDrawer persona="agent" mode="expanded" locale="ar" />, '/dashboard')
    expect(screen.getByText('العمل')).toBeInTheDocument()
    expect(screen.getByText('النمو')).toBeInTheDocument()
  })

  it('renders collapsed rail at 60px with expand control', async () => {
    const onModeChange = vi.fn()
    const userEv = userEvent.setup()
    wrap(<SideDrawer persona="agent" mode="rail" onModeChange={onModeChange} />, '/listings')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav.className).toMatch(/w-\[60px\]/)
    await userEv.click(screen.getByRole('button', { name: /Expand navigation/i }))
    expect(onModeChange).toHaveBeenCalledWith('expanded')
  })
})

describe('GlobalSearch', () => {
  it('opens via Ctrl+K and uses agent placeholder copy', async () => {
    const userEv = userEvent.setup()
    wrap(<GlobalSearch persona="agent" locale="en" triggerVariant="input" />)
    expect(
      screen.getByRole('button', { name: SEARCH_COPY.en.placeholder.agent }),
    ).toBeInTheDocument()
    await userEv.keyboard('{Control>}k{/Control}')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(SEARCH_COPY.en.placeholder.agent)).toBeInTheDocument()
  })

  it('uses PA Arabic placeholder', async () => {
    wrap(
      <GlobalSearch persona="pa" locale="ar" triggerVariant="icon" open onOpenChange={() => {}} />,
    )
    expect(await screen.findByPlaceholderText(SEARCH_COPY.ar.placeholder.pa)).toBeInTheDocument()
  })
})

describe('UserMenu', () => {
  it('exposes EN menu rows', async () => {
    const userEv = userEvent.setup()
    wrap(<UserMenu user={user} locale="en" />)
    await userEv.click(screen.getByLabelText('Sara Agent'))
    expect(await screen.findByText(USER_MENU_COPY.en.profile)).toBeInTheDocument()
    expect(screen.getByText(USER_MENU_COPY.en.signout)).toBeInTheDocument()
  })

  it('renders Arabic labels', async () => {
    const userEv = userEvent.setup()
    wrap(<UserMenu user={user} locale="ar" />)
    await userEv.click(screen.getByLabelText('Sara Agent'))
    expect(await screen.findByText(USER_MENU_COPY.ar.profile)).toBeInTheDocument()
    expect(screen.getByText(USER_MENU_COPY.ar.signout)).toBeInTheDocument()
  })
})

describe('NotificationsPopover', () => {
  it('shows unread badge count and header copy', async () => {
    const userEv = userEvent.setup()
    wrap(
      <NotificationsPopover
        locale="en"
        notifications={[
          { id: '1', title: 'A', snippet: 'a', timestamp: new Date().toISOString(), unread: true },
          { id: '2', title: 'B', snippet: 'b', timestamp: new Date().toISOString(), unread: true },
          { id: '3', title: 'C', snippet: 'c', timestamp: new Date().toISOString(), unread: false },
        ]}
      />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
    await userEv.click(screen.getByRole('button', { name: /Notifications: 2 new/i }))
    expect(await screen.findByText(NOTIFICATIONS_COPY.en.header)).toBeInTheDocument()
    expect(screen.getByText(NOTIFICATIONS_COPY.en.markAll)).toBeInTheDocument()
  })

  it('shows Arabic empty state', async () => {
    const userEv = userEvent.setup()
    wrap(<NotificationsPopover locale="ar" notifications={[]} />)
    await userEv.click(screen.getByRole('button', { name: /^الإشعارات$/i }))
    expect(await screen.findByText(NOTIFICATIONS_COPY.ar.empty)).toBeInTheDocument()
  })
})

describe('RTL chrome', () => {
  it('keeps primary navigation landmark under dir=rtl', () => {
    document.documentElement.dir = 'rtl'
    wrap(<SideDrawer persona="agent" mode="expanded" locale="ar" />, '/inbox')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    document.documentElement.dir = 'ltr'
  })
})
