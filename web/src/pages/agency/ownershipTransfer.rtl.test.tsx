// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { OwnershipLoadState } from '@/hooks/useOwnershipTransfer'
import type { OwnershipTransfer, OwnershipTransferStatus } from '@/types/ownershipTransfer'

expect.extend(toHaveNoViolations)

const { hook, authAgent } = vi.hoisted(() => ({
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
    cancel: vi.fn(),
    acknowledge: vi.fn(),
    reverse: vi.fn(),
  },
  authAgent: { current: { id: 'usr_sara', email: 'sara@elite.ae' } as { id: string; email: string } },
}))

vi.mock('@/hooks/useOwnershipTransfer', () => ({ useOwnershipTransfer: () => hook }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ agent: authAgent.current }) }))
// Arabic locale for the whole suite — exercises the real MENA copy path.
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => ({ locale: 'ar', isArabic: true, dir: 'rtl', setLocale: vi.fn() }) }))
vi.mock('@/hooks/useStepUpPrompt', () => ({ useStepUpPrompt: () => ({ modal: null, requestElevation: vi.fn().mockResolvedValue(true) }) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }))

import { AgencyOwnershipTransferInitiatorPage } from './AgencyOwnershipTransferInitiatorPage'
import { AgencyOwnershipTransferAcceptPage } from './AgencyOwnershipTransferAcceptPage'
import { OwnershipTransferOutcomePage } from '@/pages/agent/OwnershipTransferOutcomePage'

function transferOf(status: OwnershipTransferStatus, overrides: Partial<OwnershipTransfer> = {}): OwnershipTransfer {
  return {
    id: 'ot_1',
    agency_id: 'agc_1',
    status,
    initiator_user_id: 'usr_sara',
    target_user_id: 'usr_ahmad',
    rationale: 'التراجع عن العمليات اليومية.',
    decline_reason: null,
    initiated_at: '2026-09-07T09:14:22Z',
    expires_at: '2026-09-21T09:14:22Z',
    decided_at: status === 'pending' ? null : '2026-09-08T12:32:00Z',
    executed_at: status === 'executed' ? '2026-09-08T12:32:00Z' : null,
    reversed_at: null,
    reversal_deadline_at: null,
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
      eligibleAdmins: [{ user_id: 'usr_ahmad', display_name: 'Ahmad Khoury', role: 'admin', avatar_url: null }],
    },
    data: {
      transfer,
      eligibility: { caller_is_owner: true, agency_transferable: true, block_reason: null, eligible_admin_count: 1 },
    },
  }
}

describe('WF-31 ownership transfer — Arabic (RTL)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authAgent.current = { id: 'usr_sara', email: 'sara@elite.ae' }
  })

  it('AGN-SET-005 renders real Arabic copy with no pending markers and no a11y violations', async () => {
    hook.state = ready(null)
    const { container } = render(
      <MemoryRouter initialEntries={['/agency/settings/ownership-transfer']}>
        <AgencyOwnershipTransferInitiatorPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /نقل ملكية Elite Real Estate/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /اختر المالك الجديد/ })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/TRANSLATION-PENDING/)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('AGN-SET-005b renders the recipient heading in Arabic', () => {
    authAgent.current = { id: 'usr_ahmad', email: 'ahmad@elite.ae' }
    hook.state = ready(transferOf('pending'))
    render(
      <MemoryRouter initialEntries={['/agency/ownership-transfer/incoming/ot_1']}>
        <Routes>
          <Route path="/agency/ownership-transfer/incoming/:transferId" element={<AgencyOwnershipTransferAcceptPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /يريد Sara Al Mansoori نقل ملكية/ })).toBeInTheDocument()
  })

  it('AGT-REC-006 renders the outcome hero in Arabic', () => {
    authAgent.current = { id: 'usr_sara', email: 'sara@elite.ae' }
    hook.state = ready(transferOf('executed'))
    render(
      <MemoryRouter initialEntries={['/inbox/ownership-transfers/ot_1']}>
        <Routes>
          <Route path="/inbox/ownership-transfers/:transferId" element={<OwnershipTransferOutcomePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText(/أنت بدأت هذا النقل/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /نقلت ملكية Elite Real Estate/ })).toBeInTheDocument()
  })
})
