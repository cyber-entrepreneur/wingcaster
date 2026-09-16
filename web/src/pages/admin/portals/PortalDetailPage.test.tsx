// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PortalDetailPage } from './PortalDetailPage'
import type { PortalAdmin } from './types'

expect.extend(toHaveNoViolations)

const apiMock = vi.hoisted(() => ({
  getPortal: vi.fn(),
  createPortal: vi.fn(),
  updatePortal: vi.fn(),
  requestActivation: vi.fn(),
  requestDeactivation: vi.fn(),
  approveActivation: vi.fn(),
  rejectActivation: vi.fn(),
  withdrawActivation: vi.fn(),
  deprecatePortal: vi.fn(),
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

const stepUpMock = vi.hoisted(() => ({
  requireElevation: vi.fn(async () => true),
  runElevated: vi.fn(async (action: () => Promise<unknown>) => action()),
}))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => stepUpMock,
}))

const localeMock = vi.hoisted(() => ({ current: { locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() } }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => localeMock.current,
}))

function portal(overrides: Partial<PortalAdmin> = {}): PortalAdmin {
  return {
    id: 'bayut_ae',
    code: 'bayut_ae',
    display_name: 'Bayut UAE',
    description: 'Bayut UAE portal.',
    logo_url: null,
    country_codes: ['AE'],
    primary_language: 'en',
    adapter_class_name: 'portals/bayut.js',
    adapter_status: 'stub',
    publisher_config: { sla_hours: 4 },
    inbound_config: {},
    validator_ref: null,
    is_active: false,
    current_version: 2,
    connected_agents_env: 0,
    connected_agents_env_name: 'live',
    connected_agencies_env: 0,
    last_change_at: '2026-09-11T09:30:12Z',
    last_change_by: { id: 'usr_karim', display_name: 'Karim Nasr' },
    pending_activation: null,
    sla_hours: 4,
    deprecated_at: null,
    effective_from: null,
    created_at: '2026-09-01T11:02:00Z',
    updated_at: '2026-09-11T09:30:12Z',
    ...overrides,
  }
}

function renderDetail(mode: 'view' | 'edit' | 'create', initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/admin/portals/new" element={<PortalDetailPage mode="create" />} />
        <Route path="/admin/portals/:code/edit" element={<PortalDetailPage mode="edit" />} />
        <Route path="/admin/portals/:code" element={<PortalDetailPage mode="view" />} />
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
  apiMock.getPortal.mockResolvedValue(portal())
  apiMock.createPortal.mockResolvedValue(portal({ code: 'aqar_sa', display_name: 'Aqar KSA' }))
  apiMock.requestActivation.mockResolvedValue({ pending: { id: 'p1' } })
  apiMock.approveActivation.mockResolvedValue({ portal: portal({ is_active: true }), pending: { id: 'p1' } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PortalDetailPage (PA-POR-002)', () => {
  it('view mode renders the portal with code, sections, and status badges', async () => {
    renderDetail('view', '/admin/portals/bayut_ae')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Bayut UAE' })).toBeInTheDocument(),
    )
    expect(apiMock.getPortal).toHaveBeenCalledWith('bayut_ae', undefined)
    expect(screen.getByText('Identity')).toBeInTheDocument()
    expect(screen.getByText('Activation')).toBeInTheDocument()
    expect(screen.getByText('PUBLISHING_REALESTATE_BAYUT_AE')).toBeInTheDocument()
  })

  it('activation request is blocked for a STUB adapter', async () => {
    renderDetail('view', '/admin/portals/bayut_ae')
    await screen.findByRole('heading', { name: 'Bayut UAE' })
    const requestBtn = screen.getByRole('button', { name: 'Request activation' })
    expect(requestBtn).toBeDisabled()
  })

  it('requests activation (step-up) for a live-adapter inactive portal', async () => {
    apiMock.getPortal.mockResolvedValue(portal({ adapter_status: 'live' }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDetail('view', '/admin/portals/bayut_ae')
    await screen.findByRole('heading', { name: 'Bayut UAE' })
    await user.click(screen.getByRole('button', { name: 'Request activation' }))
    await waitFor(() => expect(apiMock.requestActivation).toHaveBeenCalledWith('bayut_ae', expect.any(Object)))
    expect(stepUpMock.runElevated).toHaveBeenCalled()
  })

  it('approver (different admin) can approve a pending activation', async () => {
    apiMock.getPortal.mockResolvedValue(
      portal({
        adapter_status: 'live',
        pending_activation: {
          id: 'pend_1',
          portal_code: 'bayut_ae',
          action: 'activate',
          state: 'pending',
          submitter_user_id: 'usr_karim',
          approver_user_id: null,
          submitter_notes: 'Adapter shipped in PR #67.',
          approver_notes: null,
          effective_from: null,
          created_at: '2026-09-12T09:30:12Z',
        },
      }),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDetail('view', '/admin/portals/bayut_ae')
    await screen.findByText('Adapter shipped in PR #67.')
    await user.click(screen.getByRole('button', { name: 'Approve activation' }))
    await waitFor(() =>
      expect(apiMock.approveActivation).toHaveBeenCalledWith('bayut_ae', 'activate', expect.any(Object)),
    )
  })

  it('own-submission pending shows the withdraw affordance instead of approve', async () => {
    apiMock.getPortal.mockResolvedValue(
      portal({
        adapter_status: 'live',
        pending_activation: {
          id: 'pend_1',
          portal_code: 'bayut_ae',
          action: 'activate',
          state: 'pending',
          submitter_user_id: 'pa-1',
          approver_user_id: null,
          submitter_notes: 'Ready to go.',
          approver_notes: null,
          effective_from: null,
          created_at: '2026-09-12T09:30:12Z',
        },
      }),
    )
    renderDetail('view', '/admin/portals/bayut_ae')
    await screen.findByRole('heading', { name: 'Bayut UAE' })
    expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve activation' })).not.toBeInTheDocument()
  })

  it('create mode saves a new portal after required fields are filled', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDetail('create', '/admin/portals/new')
    await screen.findByText('Identity')
    await user.type(screen.getByLabelText('Portal code'), 'aqar_sa')
    await user.type(screen.getByLabelText('Display name'), 'Aqar KSA')
    await user.type(screen.getByLabelText('Add country'), 'SA')
    await user.click(screen.getByRole('button', { name: 'Add country' }))
    const save = screen.getByRole('button', { name: 'Create portal' })
    await waitFor(() => expect(save).toBeEnabled())
    await user.click(save)
    await waitFor(() =>
      expect(apiMock.createPortal).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'aqar_sa', display_name: 'Aqar KSA', country_codes: ['SA'] }),
      ),
    )
  })

  it('flags a raw secret pasted into publisher config and blocks save', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDetail('edit', '/admin/portals/bayut_ae/edit')
    await screen.findByText('Identity')
    const editor = screen.getByLabelText('Publisher config (JSON)')
    await user.clear(editor)
    await user.type(editor, '{{"api_key":"sk_thisisaverylongrawsecretvalue1234567"}')
    await waitFor(() =>
      expect(
        screen.getAllByText(/Looks like a raw secret/i).length,
      ).toBeGreaterThan(0),
    )
  })

  it('has no axe violations in view mode', async () => {
    apiMock.getPortal.mockResolvedValue(portal({ adapter_status: 'live' }))
    const { container } = renderDetail('view', '/admin/portals/bayut_ae')
    await screen.findByRole('heading', { name: 'Bayut UAE' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders real Arabic copy in RTL locale (view mode)', async () => {
    localeMock.current = { locale: 'ar', isArabic: true, dir: 'rtl', setLocale: vi.fn() }
    renderDetail('view', '/admin/portals/bayut_ae')
    await screen.findByRole('heading', { name: 'Bayut UAE' })
    expect(screen.getByText('الهوية')).toBeInTheDocument()
    expect(screen.getByText('التفعيل')).toBeInTheDocument()
  })

  it('deactivation request for an active portal', async () => {
    apiMock.getPortal.mockResolvedValue(portal({ adapter_status: 'live', is_active: true }))
    apiMock.requestDeactivation.mockResolvedValue({ pending: { id: 'p2' } })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDetail('view', '/admin/portals/bayut_ae')
    await screen.findByRole('heading', { name: 'Bayut UAE' })
    await user.click(screen.getByRole('button', { name: 'Request deactivation' }))
    await waitFor(() => expect(apiMock.requestDeactivation).toHaveBeenCalledWith('bayut_ae', expect.any(Object)))
  })

  it('deprecate confirm dialog wires the deprecate call', async () => {
    apiMock.deprecatePortal.mockResolvedValue(portal({ deprecated_at: '2026-09-16T13:37:00Z' }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDetail('view', '/admin/portals/bayut_ae')
    await screen.findByRole('heading', { name: 'Bayut UAE' })
    await user.click(screen.getByRole('button', { name: 'Deprecate portal' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Deprecate' }))
    await waitFor(() => expect(apiMock.deprecatePortal).toHaveBeenCalledWith('bayut_ae'))
  })
})
