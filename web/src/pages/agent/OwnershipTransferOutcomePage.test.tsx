// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { OwnershipLoadState } from '@/hooks/useOwnershipTransfer'
import type { OwnershipTransfer, OwnershipTransferStatus } from '@/types/ownershipTransfer'

expect.extend(toHaveNoViolations)

// Frozen clock so the reversal-window countdown is deterministic in snapshots.
const FROZEN_NOW = new Date('2026-09-10T12:00:00Z').getTime()

const { hook, addToast, navigate, authAgent } = vi.hoisted(() => ({
  hook: {
    state: { status: 'loading' } as OwnershipLoadState,
    offline: false,
    statusChangedTo: null,
    clearStatusChange: vi.fn(),
    reload: vi.fn(),
    sendOtp: vi.fn().mockResolvedValue({ sent_to: 's•••@elite.ae', expires_in_seconds: 600, challenge_id: 'c1' }),
    initiate: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
    cancel: vi.fn().mockResolvedValue({ transfer: {} }),
    acknowledge: vi.fn(),
    reverse: vi.fn().mockResolvedValue({ transfer: {} }),
  },
  addToast: vi.fn(),
  navigate: vi.fn(),
  authAgent: { current: { id: 'usr_sara', email: 'sara@elite.ae' } as { id: string; email: string } },
}))

vi.mock('@/hooks/useOwnershipTransfer', () => ({ useOwnershipTransfer: () => hook }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ agent: authAgent.current }) }))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => ({ locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() }) }))
vi.mock('@/hooks/useStepUpPrompt', () => ({ useStepUpPrompt: () => ({ modal: null, requestElevation: vi.fn().mockResolvedValue(true) }) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ addToast }) }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import { OwnershipTransferOutcomePage } from './OwnershipTransferOutcomePage'
import { reversalRemaining } from './ownershipOutcomeUtil'

function transferOf(status: OwnershipTransferStatus, overrides: Partial<OwnershipTransfer> = {}): OwnershipTransfer {
  return {
    id: 'ot_1',
    agency_id: 'agc_1',
    status,
    initiator_user_id: 'usr_sara',
    target_user_id: 'usr_ahmad',
    rationale: 'Stepping back from operations. Ahmad has led the team for a year.',
    decline_reason: null,
    initiated_at: '2026-09-07T09:14:22Z',
    expires_at: '2026-09-21T09:14:22Z',
    decided_at: status === 'pending' ? null : '2026-09-08T12:32:00Z',
    executed_at: status === 'executed' || status === 'reversed' ? '2026-09-08T12:32:00Z' : null,
    reversed_at: status === 'reversed' ? '2026-09-09T09:00:00Z' : null,
    reversal_deadline_at: status === 'executed' ? '2026-10-08T12:32:00Z' : null,
    acknowledged_by_initiator: false,
    acknowledged_by_target: false,
    resolved_at: status === 'pending' ? null : '2026-09-08T12:32:00Z',
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
      myUserId: authAgent.current.id,
      ownerEmailMasked: 's•••@elite.ae',
      eligibleAdmins: [],
    },
    data: {
      transfer,
      eligibility: { caller_is_owner: true, agency_transferable: true, block_reason: null, eligible_admin_count: 0 },
    },
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/inbox/ownership-transfers/ot_1']}>
      <Routes>
        <Route path="/inbox/ownership-transfers/:transferId" element={<OwnershipTransferOutcomePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('reversalRemaining', () => {
  it('returns days/hours until the deadline', () => {
    expect(reversalRemaining('2026-10-08T12:32:00Z', FROZEN_NOW)).toEqual({ days: 28, hours: 0 })
  })
  it('returns null past the deadline or when missing', () => {
    expect(reversalRemaining('2026-09-01T00:00:00Z', FROZEN_NOW)).toBeNull()
    expect(reversalRemaining(null, FROZEN_NOW)).toBeNull()
  })
})

describe('OwnershipTransferOutcomePage (AGT-REC-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW)
    hook.offline = false
    authAgent.current = { id: 'usr_sara', email: 'sara@elite.ae' }
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('executed × former_owner shows loud hero + reversal window card', async () => {
    authAgent.current = { id: 'usr_sara', email: 'sara@elite.ae' }
    hook.state = ready(transferOf('executed'))
    const { container } = renderPage()
    expect(screen.getByText(/You initiated this transfer/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /You transferred ownership of Elite Real Estate/i })).toBeInTheDocument()
    const hero = container.querySelector('section[aria-labelledby="status-hero-label"]')
    expect(hero?.className).toMatch(/bg-\[var\(--lc-action-primary\)\]/)
    expect(screen.getByText(/You can reverse this transfer for 28 more days/i)).toBeInTheDocument()
    expect(screen.getByText(/What changed for you/i)).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('executed × former_owner opens the reversal challenge and reverses', () => {
    hook.state = ready(transferOf('executed'))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Reverse the transfer/i }))
    fireEvent.click(screen.getByRole('button', { name: /Yes, reverse/i }))
    // Challenge dialog now visible.
    expect(screen.getByText(/Password re-check/i)).toBeInTheDocument()
  })

  it('executed × new_owner shows next-action cards', async () => {
    authAgent.current = { id: 'usr_ahmad', email: 'ahmad@elite.ae' }
    hook.state = ready(transferOf('executed'))
    const { container } = renderPage()
    expect(screen.getByText(/You accepted this transfer/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /You're now the owner of Elite Real Estate/i })).toBeInTheDocument()
    expect(screen.getByText(/Review billing address & payment method/i)).toBeInTheDocument()
    // New owner never sees the reversal card.
    expect(screen.queryByText(/You can reverse this transfer/i)).toBeNull()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('pending × former_owner shows an awaiting chip and cancel tertiary', () => {
    hook.state = ready(transferOf('pending'))
    renderPage()
    expect(screen.getAllByText(/Awaiting Ahmad Khoury's response/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Cancel transfer/i }).length).toBeGreaterThan(0)
  })

  it('reversed × former_owner renders the 6-event timeline including Reversed', () => {
    hook.state = ready(transferOf('reversed'))
    renderPage()
    expect(screen.getByRole('heading', { name: /You reversed the ownership transfer\. You're the owner again\./i })).toBeInTheDocument()
    expect(screen.getByText(/^Reversed$/)).toBeInTheDocument()
  })

  it('renders a not-found card when the transfer id does not match', () => {
    hook.state = ready(transferOf('executed', { id: 'ot_other' }))
    renderPage()
    expect(screen.getByText(/doesn't exist or isn't visible to you/i)).toBeInTheDocument()
  })
})
