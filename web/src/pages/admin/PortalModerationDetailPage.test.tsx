// @vitest-environment jsdom
/**
 * PA-MOD-002 PortalModerationDetailPage — load, decision guards, modals, a11y.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axeCore from 'axe-core'
import { toHaveNoViolations } from 'jest-axe'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { PortalModerationSubmission } from '@/api/portalModeration'
import { PortalModerationDetailPage } from './PortalModerationDetailPage'

expect.extend(toHaveNoViolations)

const sampleSubmission = (overrides: Partial<PortalModerationSubmission> = {}): PortalModerationSubmission => ({
  id: 'psub_abc123',
  submitted_at: '2026-09-07T12:04:11Z',
  status: 'pending',
  env: 'live',
  is_own: false,
  is_already_decided: false,
  step_up_required: false,
  decision: null,
  listing: {
    id: 'lst_marina_1204',
    title: '3BR apartment · Dubai Marina',
    address_line: 'Marina Gate 2, Tower A, Apt 1204',
    hero_image_url: null,
  },
  listing_preview: {
    hero_image_url: null,
    gallery: [],
    price: { amount_minor: 285000000, currency: 'AED', basis: 'sale' },
    specs: { beds: 3, baths: 3, area_m2: 168 },
    amenities: ['pool', 'gym', 'concierge', 'parking'],
    description: 'Beautiful 3BR corner unit on the 24th floor.',
    agent_contact: {
      phone_masked: '+971 5* *** **12',
      email_masked: 's***@***.com',
      whatsapp_deeplink: 'https://wa.me/971500000012',
    },
  },
  agent: {
    id: 'usr_xyz789',
    display_name: 'Sara Al Mansouri',
    avatar_url: null,
  },
  agent_context: {
    wingcaster_tenure_month: '2024-01',
    portfolio_size: 27,
    prior_decision_summary_30d: { approved: 12, rejected: 1, request_info: 0 },
  },
  agency: {
    id: 'agy_dubai_elite',
    name: 'Elite Real Estate Dubai',
    tenant_url: '/admin/tenants/agy_dubai_elite',
    two_person_reject_required: false,
  },
  portal: {
    code: 'property_finder_ae',
    display_name: 'Property Finder AE',
    country_code: 'AE',
    country_flag_emoji: '🇦🇪',
  },
  validator_lint: {
    pass_count: 6,
    warn_count: 0,
    fail_count: 0,
    checks: [
      {
        code: 'trakheesi_number_present',
        severity: 'pass',
        message: 'Trakheesi number present.',
        expected: 'Non-empty',
        actual: '1234567890',
      },
      {
        code: 'photo_count_min',
        severity: 'pass',
        message: '8 photos (min 4).',
      },
    ],
  },
  tenure_risk: { tier: 'low', score: 0.12, signals: ['agency_age_days:1240'] },
  portal_payload_preview: { listing: { title: '3BR apartment · Dubai Marina' }, portal: 'property_finder_ae' },
  notification_previews: {
    approve: "Your listing '3BR apartment · Dubai Marina' has been published to Property Finder AE.",
    reject:
      'Your listing was not published to Property Finder AE. Reason: {reason_code_label}. Notes: {notes}',
    request_info:
      'Your listing needs an update before Property Finder AE will publish it. Reason: {reason_code_label}. Notes: {notes}',
  },
  queue_position: { position: 3, total: 18 },
  ...overrides,
})

const apiMock = vi.hoisted(() => ({
  getPortalModerationSubmission: vi.fn(),
  getPortalModerationSibling: vi.fn(),
  getPortalModerationHistory: vi.fn(),
  getPortalModerationAudit: vi.fn(),
  approvePortalModerationSubmission: vi.fn(),
  rejectPortalModerationSubmission: vi.fn(),
  requestInfoPortalModerationSubmission: vi.fn(),
  undoPortalModerationApprove: vi.fn(),
  undoPortalModerationReject: vi.fn(),
  revealPortalModerationContact: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

const stepUpMock = vi.hoisted(() => ({
  runElevated: vi.fn(async (action: () => unknown) => action()),
  requireElevation: vi.fn(async () => true),
}))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => stepUpMock,
  StepUpProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/hooks/useEnv', () => ({
  useEnv: () => ({
    env: 'live',
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
}))

const toastMock = vi.hoisted(() => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }))
vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>('@/components/ui/toast')
  return { ...actual, useToast: () => toastMock }
})

function renderPage(path = '/admin/moderation/portals/psub_abc123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/moderation/portals/:submissionId" element={<PortalModerationDetailPage />} />
        <Route path="/admin/moderation/portals" element={<div>Queue</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function axeContainer(container: HTMLElement) {
  return axeCore.run(container, {
    rules: {
      // Radix Dialog portals + decorative imgs without alt in gallery thumbs
      'image-redundant-alt': { enabled: false },
    },
  })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  stepUpMock.runElevated.mockImplementation(async (action: () => unknown) => action())
  apiMock.getPortalModerationSubmission.mockResolvedValue({ submission: sampleSubmission() })
  apiMock.getPortalModerationSibling.mockResolvedValue({ next_submission_id: 'psub_next' })
  apiMock.getPortalModerationHistory.mockResolvedValue([])
  apiMock.getPortalModerationAudit.mockResolvedValue([])
  apiMock.approvePortalModerationSubmission.mockResolvedValue({ status: 'approved' })
  apiMock.rejectPortalModerationSubmission.mockResolvedValue({ status: 'rejected' })
  apiMock.requestInfoPortalModerationSubmission.mockResolvedValue({ status: 'request_info' })
  // jsdom matchMedia for any consumer
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width: 1024') ? true : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('PortalModerationDetailPage', () => {
  it('loads submission and renders listing title as h1', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: /3BR apartment · Dubai Marina/i })).toBeInTheDocument()
    expect(screen.getByText(/Marina Gate 2/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Submission/)
    expect(screen.getByText(/PORTAL PREVIEW — Property Finder AE/i)).toBeInTheDocument()
    expect(screen.getByText(/Wingcaster preview of portal render/i)).toBeInTheDocument()
  })

  it('shows validator lint aggregate and collapsed passing checks', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText(/Per-portal validator · Property Finder AE/i)).toBeInTheDocument()
    expect(screen.getByText((content, el) => el?.tagName === 'P' && /6\s+pass · 0\s+warn · 0\s+fail/.test(el.textContent || ''))).toBeInTheDocument()
    const showPassing = screen.getByRole('button', { name: /Show .* passing checks/i })
    await userEvent.click(showPassing)
    expect(screen.getByText(/trakheesi_number_present/i)).toBeInTheDocument()
  })

  it('renders own-submission block instead of decision buttons', async () => {
    apiMock.getPortalModerationSubmission.mockResolvedValue({
      submission: sampleSubmission({ is_own: true }),
    })
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText(/can't decide this submission/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve — publish/i })).not.toBeInTheDocument()
  })

  it('shows high-risk step-up notice and two-person reject notice', async () => {
    apiMock.getPortalModerationSubmission.mockResolvedValue({
      submission: sampleSubmission({
        tenure_risk: { tier: 'high', score: 0.9, signals: [] },
        agency: {
          id: 'agy_riyadh',
          name: 'Riyadh Off-Plan Partners',
          tenant_url: '/admin/tenants/agy_riyadh',
          two_person_reject_required: true,
        },
      }),
    })
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText(/High-risk submission\. Step-up required/i)).toBeInTheDocument()
    expect(screen.getByText(/requires a second PA approval/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send to second approver/i })).toBeInTheDocument()
  })

  it('opens approve confirm modal and posts approve', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: /Approve — publish to Property Finder AE/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/push this listing to Property Finder AE/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Approve all/i }))
    await waitFor(() => expect(apiMock.approvePortalModerationSubmission).toHaveBeenCalledWith('psub_abc123'))
    expect(toastMock.addToast).toHaveBeenCalled()
  })

  it('opens reject modal with reason vocab and posts reject', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: /Reject with reason/i }))
    const dialog = await screen.findByRole('dialog')
    const select = within(dialog).getByLabelText(/Reason/i)
    await user.selectOptions(select, 'insufficient_photos')
    await user.click(within(dialog).getByRole('button', { name: /Reject all/i }))
    await waitFor(() =>
      expect(apiMock.rejectPortalModerationSubmission).toHaveBeenCalledWith('psub_abc123', {
        reason_code: 'insufficient_photos',
        notes: '',
      }),
    )
  })

  it('requires step-up via runElevated for high-risk approve', async () => {
    apiMock.getPortalModerationSubmission.mockResolvedValue({
      submission: sampleSubmission({
        tenure_risk: { tier: 'high', score: 0.9 },
        step_up_required: true,
      }),
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: /Approve — publish/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /Approve all/i }))
    await waitFor(() => expect(stepUpMock.runElevated).toHaveBeenCalled())
  })

  it('deep-links tab=audit and loads audit events', async () => {
    apiMock.getPortalModerationAudit.mockResolvedValue([
      {
        at: '2026-09-07T12:04:11Z',
        kind: 'submitted',
        actor: 'Sara Al Mansouri',
        description: 'Submission created',
      },
    ])
    renderPage('/admin/moderation/portals/psub_abc123?tab=audit')
    await screen.findByRole('heading', { level: 1 })
    expect(await screen.findByText(/Submission created/i)).toBeInTheDocument()
  })

  it('renders portal payload JSON in the payload tab', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('button', { name: /Copy JSON/i })).toBeInTheDocument()
    expect(screen.getByText(/"portal": "property_finder_ae"/)).toBeInTheDocument()
  })

  it('shows not-found block on 404', async () => {
    const err = Object.assign(new Error('not found'), { status: 404 })
    apiMock.getPortalModerationSubmission.mockRejectedValue(err)
    renderPage()
    expect(await screen.findByText(/Submission not found or archived/i)).toBeInTheDocument()
  })

  it('is axe-clean on ready pending state', async () => {
    const { container } = renderPage()
    await screen.findByRole('heading', { level: 1 })
    // Force desktop layout branch visible for axe (lg:hidden gate still in DOM)
    const results = await axeContainer(container)
    expect(results).toHaveNoViolations()
  })
})
