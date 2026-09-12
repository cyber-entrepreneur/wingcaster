// @vitest-environment jsdom
/**
 * PA-ACR-002 colocated tests — cast-vote contract, self-approval guard,
 * PII masked-by-default, two-person progress.
 */
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  ACCOUNT_RECOVERY_DECISION_ENDPOINT,
  AccountRecoveryDetailPage,
  buildCastVotePath,
} from './AccountRecoveryDetailPage'

const {
  castVoteMock,
  getCaseMock,
  revealAuditMock,
  requestInfoMock,
  cancelInfoMock,
  undoApproveMock,
  withdrawVoteMock,
  fetchEvidenceBlobMock,
} = vi.hoisted(() => ({
  castVoteMock: vi.fn(async () => ({
    success: true,
    status: 'approved',
    requires_two_person: false,
  })),
  getCaseMock: vi.fn(),
  revealAuditMock: vi.fn(async () => ({ ok: true })),
  requestInfoMock: vi.fn(async () => ({ success: true })),
  cancelInfoMock: vi.fn(async () => ({ success: true })),
  undoApproveMock: vi.fn(async () => ({ success: true })),
  withdrawVoteMock: vi.fn(async () => ({ success: true })),
  fetchEvidenceBlobMock: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
}))

vi.mock('@/api/client', () => ({
  api: {
    getAdminAccountRecoveryCase: getCaseMock,
    castAccountRecoveryVote: castVoteMock,
    revealAccountRecoveryAudit: revealAuditMock,
    requestAccountRecoveryInfo: requestInfoMock,
    cancelAccountRecoveryInfoRequest: cancelInfoMock,
    undoAccountRecoveryApprove: undoApproveMock,
    withdrawAccountRecoveryVote: withdrawVoteMock,
    fetchAccountRecoveryEvidenceBlob: fetchEvidenceBlobMock,
    accountRecoveryEvidencePath: (caseId: string, evidenceId: string, download = false) =>
      `/admin/account-recovery/${caseId}/evidence/${evidenceId}${download ? '?download=1' : ''}`,
  },
  API_BASE: '/api',
}))

const authMock = vi.hoisted(() => ({
  isAdmin: true,
  agent: { id: 'pa_current', platform_role: 'platform_admin' as const },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/hooks/useEnv', () => ({
  useEnv: () => ({ env: 'live' as const, switching: false }),
}))

vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    requireElevation: async () => true,
    runElevated: async <T,>(action: () => Promise<T>) => action(),
  }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/components/nav/EnvBadge', () => ({
  EnvBadge: ({ env }: { env: string }) => <span data-testid="env-badge">{env}</span>,
}))

function baseCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acr_b7f3a2',
    created_at: '2026-09-07T11:04:11Z',
    sla_hours_remaining: 22.97,
    sla_hours_total: 24,
    status: 'pending_review',
    reason: 'I lost access after a phishing email.',
    reason_category: 'compromised_account',
    provided: {
      preferred_channel: 'whatsapp',
      contact_masked: '+961 7X XXX XX41',
      contact_full: '+961 71 456 7841',
      request_ip_masked: '185.104.XXX.XXX',
      request_ip_full: '185.104.212.44',
      request_user_agent_masked: 'iPhone · Safari 17',
      request_user_agent_full: 'Mozilla/5.0 (iPhone)',
    },
    on_file: {
      email_masked: 's***@********.com',
      email_full: 'sara.mansouri@elitedubai.com',
      phone_masked: '+961 7X XXX XX41',
      phone_full: '+961 71 456 7841',
      username_masked: 'sa****ri',
      username_full: 'sara_mansouri',
      agency: { id: 'agy_1', name: 'Elite Real Estate Dubai', tenant_url: '/admin/tenants/agy_1' },
      plan_tier: 'enterprise',
      role: 'agency_owner',
      tenure_days: 1240,
      last_successful_login_at: '2026-08-14T09:12:00Z',
    },
    mismatches: [],
    evidence: {
      file_count: 1,
      files: [
        {
          id: 'ev_1',
          filename: 'id_front.jpg',
          uploaded_at: '2026-09-07T11:04:22Z',
          size_bytes: 218430,
          content_type: 'image/jpeg',
        },
      ],
    },
    timeline: [
      {
        at: '2026-09-07T11:10:00Z',
        channel: 'system',
        status: 'info',
        message: 'Case escalated to PA review.',
      },
    ],
    account_value_tier: 'standard',
    requires_two_person: false,
    first_vote: null,
    current_reviewer: {
      id: 'pa_current',
      is_first_reviewer_candidate: true,
      is_second_reviewer_candidate: false,
    },
    decision: null,
    escalation_case_id: null,
    is_own: false,
    env: 'live',
    ...overrides,
  }
}

function wrap(caseId = 'acr_b7f3a2'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/admin/support/account-recovery/${caseId}`]}>
      <Routes>
        <Route path="/admin/support/account-recovery/:caseId" element={<AccountRecoveryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PA-ACR-002 AccountRecoveryDetailPage', () => {
  beforeEach(() => {
    cleanup()
    authMock.isAdmin = true
    authMock.agent = { id: 'pa_current', platform_role: 'platform_admin' }
    castVoteMock.mockClear()
    getCaseMock.mockReset()
    revealAuditMock.mockClear()
    getCaseMock.mockResolvedValue(baseCase())
  })

  it('cast-vote contract: never targets legacy /approve or /reject', () => {
    expect(ACCOUNT_RECOVERY_DECISION_ENDPOINT).toBe('cast-vote')
    expect(buildCastVotePath('acr_b7f3a2')).toBe(
      '/admin/account-recovery/acr_b7f3a2/cast-vote',
    )
    expect(buildCastVotePath('acr_b7f3a2')).not.toMatch(/\/approve$|\/reject$/)
  })

  it('Approve confirm calls cast-vote with vote=approve (never /approve)', async () => {
    const user = userEvent.setup()
    wrap()
    await screen.findByRole('heading', { name: /Recovery case/i })

    expect(document.querySelector('[data-decision-endpoint="cast-vote"]')).toBeTruthy()
    expect(document.body.innerHTML).not.toMatch(/account-recovery\/[^"']+\/approve/)
    expect(document.body.innerHTML).not.toMatch(/account-recovery\/[^"']+\/reject/)

    await user.click(screen.getByRole('button', { name: /Approve · Issue recovery link/i }))
    const confirm = await screen.findByRole('button', { name: /^Issue recovery link$/i })
    expect(confirm.getAttribute('data-confirm-cast-vote')).toBe('approve')
    await user.click(confirm)

    await waitFor(() => expect(castVoteMock).toHaveBeenCalled())
    expect(castVoteMock).toHaveBeenCalledWith(
      'acr_b7f3a2',
      expect.objectContaining({ vote: 'approve' }),
    )
    expect(JSON.stringify(castVoteMock.mock.calls)).not.toMatch(/\/approve|\/reject/)
  })

  it('Reject confirm calls cast-vote with vote=reject + notes (never /reject)', async () => {
    const user = userEvent.setup()
    wrap()
    await screen.findByRole('heading', { name: /Recovery case/i })

    await user.click(screen.getByRole('button', { name: /^Reject$/i }))
    const notes = await screen.findByLabelText(/Notes for the applicant/i)
    await user.type(notes, 'Identity documents do not match the account owner on file.')
    await user.click(screen.getByRole('button', { name: /Reject request/i }))

    await waitFor(() => expect(castVoteMock).toHaveBeenCalled())
    expect(castVoteMock).toHaveBeenCalledWith(
      'acr_b7f3a2',
      expect.objectContaining({
        vote: 'reject',
        notes: expect.stringMatching(/Identity mismatch|Insufficient|documents/i),
      }),
    )
  })

  it('self-approval UI guard: own-case disables decision buttons', async () => {
    getCaseMock.mockResolvedValue(baseCase({ is_own: true }))
    wrap()
    await screen.findByText(/You can't decide your own recovery case/i)

    const approve = screen.getByRole('button', { name: /Approve · Issue recovery link/i })
    const reject = screen.getByRole('button', { name: /^Reject$/i })
    expect(approve).toBeDisabled()
    expect(reject).toBeDisabled()
    expect(document.querySelector('[data-own-case-block]')).toBeTruthy()
  })

  it('same-PA first voter: hides decision buttons and shows withdraw', async () => {
    getCaseMock.mockResolvedValue(
      baseCase({
        account_value_tier: 'high_value',
        requires_two_person: true,
        first_vote: {
          reviewer_id: 'pa_current',
          vote: 'approve',
          at: '2026-09-07T12:00:00Z',
          notes: '',
        },
        current_reviewer: {
          id: 'pa_current',
          is_first_reviewer_candidate: false,
          is_second_reviewer_candidate: false,
        },
      }),
    )
    wrap()
    await screen.findByText(/You've cast your vote/i)
    expect(screen.queryByRole('button', { name: /Approve · Issue recovery link/i })).toBeNull()
    expect(screen.getByRole('button', { name: /Withdraw my vote/i })).toBeTruthy()
    expect(screen.getByText(/A different PA must cast the second/i)).toBeTruthy()
  })

  it('PII masked by default — plaintext email/phone not visible until reveal', async () => {
    wrap()
    await screen.findByRole('heading', { name: /Recovery case/i })

    expect(screen.queryByText('sara.mansouri@elitedubai.com')).toBeNull()
    expect(screen.queryByText('+961 71 456 7841')).toBeNull()
    expect(screen.getAllByText('s***@********.com').length).toBeGreaterThan(0)

    const maskedNodes = document.querySelectorAll('[data-pii-revealed="false"]')
    expect(maskedNodes.length).toBeGreaterThan(0)
  })

  it('two-person progress renders for high_value and advances after first vote', async () => {
    getCaseMock.mockResolvedValue(
      baseCase({
        account_value_tier: 'high_value',
        requires_two_person: true,
        first_vote: null,
        current_reviewer: {
          id: 'pa_current',
          is_first_reviewer_candidate: true,
          is_second_reviewer_candidate: false,
        },
      }),
    )
    const { unmount } = wrap()
    await screen.findByRole('progressbar', { name: /Two-person approval progress/i })
    const bar = screen.getByRole('progressbar', { name: /Two-person approval progress/i })
    expect(bar.getAttribute('aria-valuenow')).toBe('0')
    expect(within(bar).getByText('First reviewer')).toBeTruthy()
    expect(within(bar).getByText('Second reviewer')).toBeTruthy()
    unmount()

    getCaseMock.mockResolvedValue(
      baseCase({
        account_value_tier: 'high_value',
        requires_two_person: true,
        first_vote: {
          reviewer_id: 'pa_other',
          vote: 'approve',
          at: '2026-09-07T12:00:00Z',
        },
        current_reviewer: {
          id: 'pa_current',
          is_first_reviewer_candidate: false,
          is_second_reviewer_candidate: true,
        },
      }),
    )
    wrap()
    const bar2 = await screen.findByRole('progressbar', { name: /Two-person approval progress/i })
    expect(bar2.getAttribute('aria-valuenow')).toBe('1')
    expect(
      screen.getByText(/First reviewer approved this case/i),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Sign off & issue recovery link/i }),
    ).toBeTruthy()
  })

  it('env badge visible (env-scoped surface)', async () => {
    wrap()
    await screen.findByTestId('env-badge')
    expect(screen.getByTestId('env-badge').textContent).toMatch(/live/i)
  })
})

// Silence unused ReactElement import if tree-shaken oddly in some TS configs
void (0 as unknown as ReactElement)
