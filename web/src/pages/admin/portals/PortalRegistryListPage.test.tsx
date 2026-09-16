// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'
import { PortalRegistryListPage } from './PortalRegistryListPage'
import type { PortalAdmin, PortalListResponse } from './types'

expect.extend(toHaveNoViolations)

const apiMock = vi.hoisted(() => ({
  listPortals: vi.fn(),
  portalsCsvPath: vi.fn(() => '/api/admin/portals.csv'),
}))
vi.mock('./api', () => apiMock)

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const authMock = vi.hoisted(() => ({
  agent: { id: 'pa-1', name: 'Priya Sharma', platform_role: 'platform_admin' },
  isAdmin: true,
  loading: false,
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const localeMock = vi.hoisted(() => ({ current: { locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() } }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => localeMock.current,
}))

function portal(overrides: Partial<PortalAdmin> = {}): PortalAdmin {
  return {
    id: 'property_finder_ae',
    code: 'property_finder_ae',
    display_name: 'Property Finder AE',
    description: 'Flagship UAE portal.',
    logo_url: null,
    country_codes: ['AE'],
    primary_language: 'en',
    adapter_class_name: 'portals/property_finder.js',
    adapter_status: 'live',
    publisher_config: { sla_hours: 6 },
    inbound_config: {},
    validator_ref: 'backend/src/lib/portal-validators/property_finder.js',
    is_active: true,
    current_version: 7,
    connected_agents_env: 142,
    connected_agents_env_name: 'live',
    connected_agencies_env: 21,
    last_change_at: '2026-09-06T09:30:12Z',
    last_change_by: { id: 'usr_rania', display_name: 'Rania Farah' },
    pending_activation: null,
    sla_hours: 6,
    deprecated_at: null,
    effective_from: '2026-06-14T11:02:00Z',
    created_at: '2026-06-14T11:02:00Z',
    updated_at: '2026-09-06T09:30:12Z',
    ...overrides,
  }
}

function listPayload(portals: PortalAdmin[]): PortalListResponse {
  return {
    portals,
    pagination: { page: 1, page_size: 25, total: portals.length, has_next: false },
    counts: {
      total: portals.length,
      live: portals.filter((p) => p.adapter_status === 'live').length,
      stub: portals.filter((p) => p.adapter_status === 'stub').length,
      deprecated: portals.filter((p) => p.adapter_status === 'deprecated').length,
      countries_covered: 3,
    },
  }
}

function renderList(initial = '/admin/portals') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <PortalRegistryListPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localeMock.current = { locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() }
  // Freeze the clock so relative-time labels are deterministic.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-16T13:37:00Z'))
  // PA console is desktop-only (matchMedia min-width:1024px).
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  apiMock.listPortals.mockResolvedValue(
    listPayload([
      portal(),
      portal({
        id: 'bayut_ae',
        code: 'bayut_ae',
        display_name: 'Bayut UAE',
        adapter_class_name: 'portals/bayut.js',
        adapter_status: 'stub',
        is_active: false,
        sla_hours: null,
        connected_agents_env: 0,
        pending_activation: null,
      }),
    ]),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PortalRegistryListPage (PA-POR-001)', () => {
  it('loads portals and renders identity, adapter status, and active state', async () => {
    renderList()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Portal registry' })).toBeInTheDocument()
    })
    expect(apiMock.listPortals).toHaveBeenCalled()
    expect(screen.getByText('Property Finder AE')).toBeInTheDocument()
    expect(screen.getByText('Bayut UAE')).toBeInTheDocument()
    expect(screen.getAllByText('STUB').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('exposes row actions (view/edit/history) with accessible names', async () => {
    renderList()
    await screen.findByText('Property Finder AE')
    expect(screen.getByLabelText('View Property Finder AE')).toBeInTheDocument()
    expect(screen.getByLabelText('Edit Property Finder AE')).toBeInTheDocument()
    expect(screen.getByLabelText('Activation history for Property Finder AE')).toBeInTheDocument()
  })

  it('? opens the keyboard shortcuts dialog', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderList()
    await screen.findByText('Property Finder AE')
    await user.keyboard('?')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Keyboard shortcuts')).toBeInTheDocument()
  })

  it('renders the empty catalog state when no portals exist', async () => {
    apiMock.listPortals.mockResolvedValue(listPayload([]))
    renderList()
    await waitFor(() =>
      expect(screen.getByText('No portals in the catalog yet')).toBeInTheDocument(),
    )
  })

  it('has no axe violations in the ready state', async () => {
    const { container } = renderList()
    await screen.findByText('Property Finder AE')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders real Arabic copy in RTL locale', async () => {
    localeMock.current = { locale: 'ar', isArabic: true, dir: 'rtl', setLocale: vi.fn() }
    renderList()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'سجلّ المنافذ' })).toBeInTheDocument()
    })
    expect(screen.getByText('إضافة منفذ')).toBeInTheDocument()
  })
})
