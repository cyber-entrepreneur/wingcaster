// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PortalActivationHistoryPage } from './PortalActivationHistoryPage'
import type { PortalHistoryEvent, PortalHistoryResponse, PortalAdmin } from './types'

expect.extend(toHaveNoViolations)

const apiMock = vi.hoisted(() => ({
  getPortalHistory: vi.fn(),
  getPortal: vi.fn(),
  portalHistoryCsvPath: vi.fn(() => '/api/admin/portals/x/history.csv'),
}))
vi.mock('./api', () => apiMock)

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

function event(overrides: Partial<PortalHistoryEvent> = {}): PortalHistoryEvent {
  return {
    id: 'phist_1',
    portal_code: 'property_finder_ae',
    event_type: 'sla_changed',
    event_at: '2026-09-06T09:30:12Z',
    submitter: { id: 'usr_rania', display_name: 'Rania Farah' },
    approver: { id: 'usr_yara', display_name: 'Yara Habib' },
    submitter_notes: 'Tighten UAE SLA from 8h to 6h.',
    approver_notes: null,
    diff: { before: { publisher_config: { sla_hours: 8 } }, after: { publisher_config: { sla_hours: 6 } } },
    version_created: 7,
    ...overrides,
  }
}

function historyPayload(events: PortalHistoryEvent[]): PortalHistoryResponse {
  return {
    events,
    pagination: { page: 1, page_size: 25, total: events.length, has_next: false },
    counts: { total: events.length },
  }
}

function portalStub(): PortalAdmin {
  return {
    id: 'property_finder_ae',
    code: 'property_finder_ae',
    display_name: 'Property Finder AE',
    description: null,
    logo_url: null,
    country_codes: ['AE'],
    primary_language: 'en',
    adapter_class_name: 'portals/property_finder.js',
    adapter_status: 'live',
    publisher_config: {},
    inbound_config: {},
    validator_ref: null,
    is_active: true,
    current_version: 7,
    connected_agents_env: 0,
    connected_agents_env_name: 'live',
    connected_agencies_env: 0,
    last_change_at: null,
    last_change_by: null,
    pending_activation: null,
    sla_hours: 6,
    deprecated_at: null,
    effective_from: null,
    created_at: null,
    updated_at: null,
  }
}

function renderHistory(initial = '/admin/portals/property_finder_ae/history') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/admin/portals/:code/history" element={<PortalActivationHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localeMock.current = { locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() }
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-16T13:37:00Z'))
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
  apiMock.getPortal.mockResolvedValue(portalStub())
  apiMock.getPortalHistory.mockResolvedValue(
    historyPayload([
      event(),
      event({
        id: 'phist_2',
        event_type: 'activated',
        event_at: '2026-06-14T11:02:00Z',
        submitter: { id: 'usr_karim', display_name: 'Karim Nasr' },
        approver: { id: 'usr_yara', display_name: 'Yara Habib' },
        submitter_notes: 'First WingCaster PF UAE publisher.',
        diff: { before: { is_active: false }, after: { is_active: true } },
        version_created: 1,
      }),
    ]),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PortalActivationHistoryPage (PA-POR-003)', () => {
  it('loads the timeline with event types and actor pairs', async () => {
    renderHistory()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Activation history — Property Finder AE' })).toBeInTheDocument(),
    )
    expect(apiMock.getPortalHistory).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'SLA changed' })).toBeInTheDocument()
    expect(screen.getByText(/Submitted by Rania Farah/)).toBeInTheDocument()
    expect(screen.getAllByText(/Approved by Yara Habib/).length).toBeGreaterThan(0)
  })

  it('auto-expands the first event diff and shows before/after', async () => {
    renderHistory()
    await screen.findByRole('heading', { name: 'SLA changed' })
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
  })

  it('links a version snapshot back into PA-POR-002', async () => {
    renderHistory()
    await screen.findByRole('heading', { name: 'SLA changed' })
    const link = screen.getByRole('link', { name: /Version 7 of the registry/ })
    expect(link).toHaveAttribute('href', '/admin/portals/property_finder_ae?version=7')
  })

  it('filters by event type via the URL', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderHistory()
    await screen.findByRole('heading', { name: 'SLA changed' })
    await user.click(screen.getByRole('button', { name: 'Activated', pressed: false }))
    await waitFor(() =>
      expect(apiMock.getPortalHistory).toHaveBeenLastCalledWith(
        'property_finder_ae',
        expect.objectContaining({ events: ['activated'] }),
      ),
    )
  })

  it('renders the empty state when a portal has no events', async () => {
    apiMock.getPortalHistory.mockResolvedValue(historyPayload([]))
    renderHistory()
    await waitFor(() => expect(screen.getByText('No activation events yet')).toBeInTheDocument())
  })

  it('has no axe violations in the ready state', async () => {
    const { container } = renderHistory()
    await screen.findByRole('heading', { name: 'SLA changed' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders real Arabic copy in RTL locale', async () => {
    localeMock.current = { locale: 'ar', isArabic: true, dir: 'rtl', setLocale: vi.fn() }
    renderHistory()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'سجلّ التفعيل — Property Finder AE' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: 'تغيّر مستوى الخدمة' })).toBeInTheDocument()
  })
})
