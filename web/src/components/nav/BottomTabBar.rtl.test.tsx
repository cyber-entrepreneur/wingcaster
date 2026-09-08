// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { LayoutDashboard } from 'lucide-react'

const apiMock = vi.hoisted(() => ({
  getConversations: vi.fn(async () => []),
  getContacts: vi.fn(async () => []),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

import { BottomTabBadge } from './BottomTabBadge'
import { BottomTab } from './BottomTab'
import { BottomTabBar } from './BottomTabBar'
import { MoreSheet } from './MoreSheet'

expect.extend(toHaveNoViolations)

beforeAll(() => {
  // vaul pointer drag helpers are absent in jsdom
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

  const originalGetComputedStyle = window.getComputedStyle.bind(window)
  window.getComputedStyle = ((elt: Element, pseudoElt?: string | null) => {
    const style = originalGetComputedStyle(elt, pseudoElt)
    if (!style.transform || style.transform === '') {
      Object.defineProperty(style, 'transform', {
        configurable: true,
        get: () => 'none',
      })
    }
    return style
  }) as typeof window.getComputedStyle
})

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width: 767px') ? matches : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

function mockVisualViewport(height: number) {
  const listeners = new Map<string, Set<() => void>>()
  const vv = {
    height,
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
  return {
    setHeight(next: number) {
      ;(vv as { height: number }).height = next
      listeners.get('resize')?.forEach((cb) => cb())
    },
  }
}

function renderBar(
  ui: React.ReactElement,
  { route = '/dashboard' }: { route?: string } = {},
) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

describe('BottomTabBadge', () => {
  it('renders numeric count and caps at maxLabel', () => {
    const { rerender } = render(<BottomTabBadge count={12} max={99} maxLabel="99+" />)
    expect(screen.getByText('12')).toBeInTheDocument()

    rerender(<BottomTabBadge count={120} max={99} maxLabel="99+" />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('renders attention dot without a number', () => {
    const { container } = render(<BottomTabBadge variant="dot" />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy()
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument()
  })

  it('renders nothing for zero count', () => {
    const { container } = render(<BottomTabBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('BottomTab', () => {
  it('marks active tab with aria-selected and shows announcement', () => {
    render(
      <BottomTab
        id="tab-dashboard"
        label="Dashboard"
        icon={LayoutDashboard}
        active
        onSelect={() => {}}
        activeAnnouncement="Currently on Dashboard"
      />,
    )
    const tab = screen.getByRole('tab', { name: /Dashboard/i })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Currently on Dashboard')).toBeInTheDocument()
  })
})

describe('BottomTabBar', () => {
  beforeEach(() => {
    mockMatchMedia(true)
    mockVisualViewport(800)
    apiMock.getConversations.mockResolvedValue([])
    apiMock.getContacts.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders five tabs with Dashboard active on /dashboard', () => {
    renderBar(<BottomTabBar forceMobile />, { route: '/dashboard' })
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    expect(screen.getByRole('tab', { name: /Dashboard/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Primary navigation')
  })

  it('shows inbox badge capped at 99+', () => {
    renderBar(<BottomTabBar forceMobile inboxUnreadCount={120} />, { route: '/inbox' })
    expect(screen.getByText('99+')).toBeInTheDocument()
    expect(screen.getByText(/99\+ unread messages/)).toBeInTheDocument()
  })

  it('shows contacts badge capped at 9+', () => {
    renderBar(<BottomTabBar forceMobile contactsAttentionCount={15} />, { route: '/contacts' })
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('shows More attention dot with accessible warning', () => {
    renderBar(<BottomTabBar forceMobile moreAttention="MFA not enrolled" />, {
      route: '/listings',
    })
    expect(screen.getByText('MFA not enrolled')).toBeInTheDocument()
  })

  it('mirrors dir for Arabic locale', () => {
    renderBar(<BottomTabBar forceMobile locale="ar" />, { route: '/dashboard' })
    expect(screen.getByRole('tablist')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByRole('tab', { name: /لوحة التحكم/ })).toBeInTheDocument()
  })

  it('navigates on tab tap', async () => {
    const user = userEvent.setup()
    renderBar(<BottomTabBar forceMobile />, { route: '/dashboard' })
    await user.click(screen.getByRole('tab', { name: /Listings/i }))
    expect(screen.getByRole('tab', { name: /Listings/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('scrolls to top when tapping the already-active tab', async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    renderBar(<BottomTabBar forceMobile />, { route: '/dashboard' })
    await user.click(screen.getByRole('tab', { name: /Dashboard/i }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('hides entirely when keyboard visible on mount', () => {
    mockVisualViewport(400)
    renderBar(<BottomTabBar forceMobile />, { route: '/dashboard' })
    expect(screen.queryByTestId('agent-bottom-tab-bar')).not.toBeInTheDocument()
  })

  it('does not render without mobile force when matchMedia is desktop', () => {
    mockMatchMedia(false)
    renderBar(<BottomTabBar />, { route: '/dashboard' })
    expect(screen.queryByTestId('agent-bottom-tab-bar')).not.toBeInTheDocument()
  })

  it('opens More sheet on More tap', async () => {
    const user = userEvent.setup()
    renderBar(<BottomTabBar forceMobile isAgencyScoped />, { route: '/dashboard' })
    await user.click(screen.getByRole('tab', { name: /More/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Business')).toBeInTheDocument()
    expect(within(dialog).getByText('Team')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Campaigns/i })).toHaveAttribute(
      'href',
      '/campaigns',
    )
  })

  it('has no axe violations', async () => {
    const { container } = renderBar(
      <BottomTabBar forceMobile inboxUnreadCount={3} contactsAttentionCount={2} />,
      { route: '/inbox' },
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('MoreSheet', () => {
  it('omits Team when not agency-scoped and fires sign out', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <MemoryRouter>
        <MoreSheet open onOpenChange={onOpenChange} onSignOut={onSignOut} showTeam={false} />
      </MemoryRouter>,
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText('Team')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Sign out/i }))
    expect(onSignOut).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders Arabic sheet header', async () => {
    render(
      <MemoryRouter>
        <MoreSheet open onOpenChange={() => {}} locale="ar" />
      </MemoryRouter>,
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('المزيد')).toBeInTheDocument()
  })
})
