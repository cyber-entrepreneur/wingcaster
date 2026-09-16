// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { OwnershipLoadState } from '@/hooks/useOwnershipTransfer'
import type { OwnershipTransfer } from '@/types/ownershipTransfer'

expect.extend(toHaveNoViolations)

const { hook, addToast, navigate } = vi.hoisted(() => ({
  hook: {
    state: { status: 'loading' } as OwnershipLoadState,
    offline: false,
    statusChangedTo: null,
    clearStatusChange: vi.fn(),
    reload: vi.fn(),
    sendOtp: vi.fn().mockResolvedValue({ sent_to: 's•••@elite.ae', expires_in_seconds: 600, challenge_id: 'c1' }),
    initiate: vi.fn().mockResolvedValue({ transfer: {} }),
    accept: vi.fn(),
    decline: vi.fn(),
    cancel: vi.fn().mockResolvedValue({ transfer: {} }),
    acknowledge: vi.fn().mockResolvedValue({ transfer: {} }),
    reverse: vi.fn(),
  },
  addToast: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@/hooks/useOwnershipTransfer', () => ({ useOwnershipTransfer: () => hook }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ agent: { id: 'usr_sara', email: 'sara@elite.ae' } }) }))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => ({ locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() }) }))
vi.mock('@/hooks/useStepUpPrompt', () => ({ useStepUpPrompt: () => ({ modal: null, requestElevation: vi.fn().mockResolvedValue(true) }) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ addToast }) }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import { AgencyOwnershipTransferInitiatorPage } from './AgencyOwnershipTransferInitiatorPage'

function baseAgency() {
  return {
    agencyId: 'agc_1',
    agencyName: 'Elite Real Estate',
    myUserId: 'usr_sara',
    ownerEmailMasked: 's•••@elite.ae',
    eligibleAdmins: [
      { user_id: 'usr_ahmad', display_name: 'Ahmad Khoury', role: 'admin', avatar_url: null },
    ],
  }
}

function pendingTransfer(overrides: Partial<OwnershipTransfer> = {}): OwnershipTransfer {
  return {
    id: 'ot_1',
    agency_id: 'agc_1',
    status: 'pending',
    initiator_user_id: 'usr_sara',
    target_user_id: 'usr_ahmad',
    rationale: 'Stepping back from operations. Ahmad has led the team for a year.',
    decline_reason: null,
    initiated_at: '2026-09-07T09:14:22Z',
    expires_at: '2026-09-21T09:14:22Z',
    decided_at: null,
    executed_at: null,
    reversed_at: null,
    reversal_deadline_at: null,
    acknowledged_by_initiator: false,
    acknowledged_by_target: false,
    resolved_at: null,
    target: { user_id: 'usr_ahmad', display_name: 'Ahmad Khoury', avatar_url: null, role: 'admin' },
    initiator: { user_id: 'usr_sara', display_name: 'Sara Al Mansoori', avatar_url: null },
    ...overrides,
  }
}

function readyState(transfer: OwnershipTransfer | null, eligibilityOverrides = {}): OwnershipLoadState {
  return {
    status: 'ready',
    agency: baseAgency(),
    data: {
      transfer,
      eligibility: {
        caller_is_owner: true,
        agency_transferable: true,
        block_reason: null,
        eligible_admin_count: 1,
        ...eligibilityOverrides,
      },
    },
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/settings/ownership-transfer']}>
      <AgencyOwnershipTransferInitiatorPage />
    </MemoryRouter>,
  )
}

describe('AgencyOwnershipTransferInitiatorPage (AGN-SET-005)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hook.offline = false
  })

  it('renders the initial form with impact banner and disabled submit', async () => {
    hook.state = readyState(null)
    const { container } = renderPage()
    expect(screen.getByRole('heading', { name: /Transfer ownership of Elite Real Estate/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /When/i })).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /Transfer ownership/i })
    expect(submit).toBeDisabled()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows not-owner fallback when caller is not the owner', () => {
    hook.state = readyState(null, { caller_is_owner: false })
    renderPage()
    expect(screen.getByText(/Only the agency owner can transfer ownership/i)).toBeInTheDocument()
  })

  it('shows the empty-state when there are no eligible admins', () => {
    const state = readyState(null, { block_reason: 'no_eligible_admins', eligible_admin_count: 0 })
    if (state.status === 'ready') state.agency.eligibleAdmins = []
    hook.state = state
    renderPage()
    expect(screen.getByText(/No eligible admins/i)).toBeInTheDocument()
  })

  it('renders the pending status view and can cancel the request', async () => {
    hook.state = readyState(pendingTransfer())
    const { container } = renderPage()
    expect(screen.getByRole('heading', { name: /Waiting on Ahmad Khoury to accept/i })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    fireEvent.click(screen.getByRole('button', { name: /Cancel request/i }))
    fireEvent.click(screen.getByRole('button', { name: /Yes, cancel/i }))
    expect(hook.cancel).toHaveBeenCalledWith('ot_1')
  })

  it('renders the target-refused view after a decline', () => {
    hook.state = readyState(
      pendingTransfer({ status: 'declined', decline_reason: 'Not ready for billing responsibility right now.', decided_at: '2026-09-08T10:00:00Z' }),
    )
    renderPage()
    expect(screen.getByText(/declined the transfer/i)).toBeInTheDocument()
    expect(screen.getByText(/Not ready for billing responsibility/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Start a new transfer/i }))
    expect(hook.acknowledge).toHaveBeenCalledWith('ot_1')
  })
})
