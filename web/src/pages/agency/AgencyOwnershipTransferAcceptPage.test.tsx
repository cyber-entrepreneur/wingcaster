// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { OwnershipLoadState } from '@/hooks/useOwnershipTransfer'
import type { OwnershipTransfer, OwnershipTransferStatus } from '@/types/ownershipTransfer'

expect.extend(toHaveNoViolations)

const { hook, addToast, navigate } = vi.hoisted(() => ({
  hook: {
    state: { status: 'loading' } as OwnershipLoadState,
    offline: false,
    statusChangedTo: null,
    clearStatusChange: vi.fn(),
    reload: vi.fn(),
    sendOtp: vi.fn().mockResolvedValue({ sent_to: 'a•••@elite.ae', expires_in_seconds: 600, challenge_id: 'c1' }),
    initiate: vi.fn(),
    accept: vi.fn().mockResolvedValue({ transfer: {} }),
    decline: vi.fn().mockResolvedValue({ transfer: {} }),
    cancel: vi.fn(),
    acknowledge: vi.fn(),
    reverse: vi.fn(),
  },
  addToast: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@/hooks/useOwnershipTransfer', () => ({ useOwnershipTransfer: () => hook }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ agent: { id: 'usr_ahmad', email: 'ahmad@elite.ae' } }) }))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => ({ locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() }) }))
vi.mock('@/hooks/useStepUpPrompt', () => ({ useStepUpPrompt: () => ({ modal: null, requestElevation: vi.fn().mockResolvedValue(true) }) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ addToast }) }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import { AgencyOwnershipTransferAcceptPage } from './AgencyOwnershipTransferAcceptPage'

function transferOf(status: OwnershipTransferStatus, overrides: Partial<OwnershipTransfer> = {}): OwnershipTransfer {
  return {
    id: 'ot_1',
    agency_id: 'agc_1',
    status,
    initiator_user_id: 'usr_sara',
    target_user_id: 'usr_ahmad',
    rationale: 'Stepping back from operations.\nAhmad has led the team for a year.',
    decline_reason: null,
    initiated_at: '2026-09-07T09:14:22Z',
    expires_at: '2026-09-21T09:14:22Z',
    decided_at: status === 'pending' ? null : '2026-09-08T10:00:00Z',
    executed_at: status === 'executed' ? '2026-09-08T10:00:00Z' : null,
    reversed_at: null,
    reversal_deadline_at: null,
    acknowledged_by_initiator: false,
    acknowledged_by_target: false,
    resolved_at: status === 'pending' ? null : '2026-09-08T10:00:00Z',
    target: { user_id: 'usr_ahmad', display_name: 'Ahmad Khoury', avatar_url: null, role: 'admin' },
    initiator: { user_id: 'usr_sara', display_name: 'Sara Al Mansoori', avatar_url: null },
    ...overrides,
  }
}

function ready(transfer: OwnershipTransfer | null): OwnershipLoadState {
  return {
    status: 'ready',
    agency: {
      agencyId: 'agc_1',
      agencyName: 'Elite Real Estate',
      myUserId: 'usr_ahmad',
      ownerEmailMasked: 'a•••@elite.ae',
      eligibleAdmins: [],
    },
    data: {
      transfer,
      eligibility: { caller_is_owner: false, agency_transferable: true, block_reason: null, eligible_admin_count: 0 },
    },
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/ownership-transfer/incoming/ot_1']}>
      <Routes>
        <Route path="/agency/ownership-transfer/incoming/:transferId" element={<AgencyOwnershipTransferAcceptPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AgencyOwnershipTransferAcceptPage (AGN-SET-005b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hook.offline = false
  })

  it('renders the accept form with the initiator rationale and disabled Accept', async () => {
    hook.state = ready(transferOf('pending'))
    const { container } = renderPage()
    expect(screen.getByRole('heading', { name: /wants to transfer ownership of Elite Real Estate to you/i })).toBeInTheDocument()
    expect(screen.getByText(/Ahmad has led the team for a year/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accept and become owner/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Decline transfer/i })).toBeEnabled()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('requires a 20-char reason before declining, then submits', async () => {
    hook.state = ready(transferOf('pending'))
    const { findByRole } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^Decline transfer$/i }))
    const dialog = await findByRole('dialog')
    const reason = screen.getByLabelText(/Reason \(required/i)
    const confirm = within(dialog).getByRole('button', { name: /^Decline transfer$/i })

    fireEvent.change(reason, { target: { value: 'short' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(reason, { target: { value: 'I am not ready to take on billing responsibility right now.' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(hook.decline).toHaveBeenCalledWith('ot_1', 'I am not ready to take on billing responsibility right now.')
  })

  it('shows the wrong-recipient terminal card when caller is not the target', () => {
    hook.state = ready(transferOf('pending', { target: { user_id: 'usr_other', display_name: 'Someone', avatar_url: null, role: 'admin' } }))
    renderPage()
    expect(screen.getByText(/wasn't sent to you/i)).toBeInTheDocument()
  })

  it('shows the cancelled terminal card', async () => {
    hook.state = ready(transferOf('cancelled'))
    const { container } = renderPage()
    expect(screen.getByText(/cancelled this transfer request/i)).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows the already-accepted terminal card for executed transfers', () => {
    hook.state = ready(transferOf('executed'))
    renderPage()
    expect(screen.getByText(/already accepted this transfer/i)).toBeInTheDocument()
  })

  it('shows invalid-token terminal card when the transfer id does not match', () => {
    hook.state = ready(transferOf('pending', { id: 'ot_other' }))
    renderPage()
    expect(screen.getByText(/no longer valid/i)).toBeInTheDocument()
  })
})
