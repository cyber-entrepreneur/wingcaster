// @vitest-environment jsdom
/**
 * WF-04 cross-loop UI e2e (Wave 3 Agent 4).
 *
 * Proves the deadlock is resolved across Phase A screens without inventing UI:
 * SHR-AUT-005d (5 states) → PA-ACR-001 queue + reveal-audit →
 * PA-ACR-002 cast-vote only (never /approve|/reject) →
 * two-person self-approval guard + disagree escalation.
 *
 * Chromatic / a11y snapshots are owned by Agent 5 (feat/wave-3-quality).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ToastProvider } from '@/components/ui/toast'
import {
  ScheduledDeletionConfirmationPage,
  type ScheduledDeletionPayload,
} from '@/pages/public/ScheduledDeletionConfirmationPage'
import {
  ACCOUNT_RECOVERY_DECISION_ENDPOINT,
  AccountRecoveryDetailPage,
  buildCastVotePath,
} from '@/pages/admin/AccountRecoveryDetailPage'
import { AccountRecoveryQueuePage } from '@/pages/admin/AccountRecoveryQueuePage'
import { PIIMask } from '@/components/security'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WEB_SRC = path.resolve(HERE, '..')

const SHR_AUT_005D_STATES = [
  'VALID_PENDING',
  'ALREADY_CANCELLED',
  'ALREADY_DELETED',
  'INVALID_TOKEN',
  'EXPIRED_TOKEN',
] as const

const TOKEN = 'v1.wf04-cross-loop.sig'

const {
  castVoteMock,
  getCaseMock,
  revealAuditMock,
  listMock,
  revealQueueMock,
  addToastMock,
} = vi.hoisted(() => ({
  castVoteMock: vi.fn(),
  getCaseMock: vi.fn(),
  revealAuditMock: vi.fn(async () => ({ ok: true })),
  listMock: vi.fn(),
  revealQueueMock: vi.fn(async () => ({ ok: true })),
  addToastMock: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    getAdminAccountRecoveryCase: getCaseMock,
    castAccountRecoveryVote: castVoteMock,
    revealAccountRecoveryAudit: revealAuditMock,
    requestAccountRecoveryInfo: vi.fn(),
    cancelAccountRecoveryInfoRequest: vi.fn(),
    undoAccountRecoveryApprove: vi.fn(),
    withdrawAccountRecoveryVote: vi.fn(async () => ({ success: true })),
    fetchAccountRecoveryEvidenceBlob: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
    accountRecoveryEvidencePath: (caseId: string, evidenceId: string, download = false) =>
      `/admin/account-recovery/${caseId}/evidence/${evidenceId}${download ? '?download=1' : ''}`,
  },
  API_BASE: '/api',
  getElevatedToken: () => null,
}))

vi.mock('@/api/accountRecovery', async () => {
  const actual = await vi.importActual<typeof import('@/api/accountRecovery')>(
    '@/api/accountRecovery',
  )
  return {
    ...actual,
    listAccountRecoveryCases: listMock,
    revealAccountRecoveryPii: revealQueueMock,
    accountRecoveryCsvPath: () => '/api/admin/account-recovery.csv?mask=true',
  }
})

const authMock = vi.hoisted(() => ({
  isAdmin: true,
  agent: { id: 'pa_current', platform_role: 'platform_admin' as const },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/hooks/useEnv', () => ({
  useEnv: () => ({
    env: 'live' as const,
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
  getWingcasterEnv: () => 'live' as const,
  WINGCASTER_ENV_HEADER: 'X-Wingcaster-Env',
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(async () => ({ ok: true as const })),
    dir: 'ltr' as const,
    isArabic: false,
  }),
}))

vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    requireElevation: async () => true,
    runElevated: async <T,>(action: () => Promise<T>) => action(),
  }),
}))

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>(
    '@/components/ui/toast',
  )
  return {
    ...actual,
    useToast: () => ({
      addToast: addToastMock,
      toasts: [],
      removeToast: vi.fn(),
    }),
  }
})

vi.mock('@/components/nav/EnvBadge', () => ({
  EnvBadge: ({ env }: { env: string }) => <span data-testid="env-badge">{env}</span>,
}))

function pendingDeletion(overrides: Partial<ScheduledDeletionPayload> = {}): ScheduledDeletionPayload {
  return {
    deletion_request_id: 'DEL-WF04',
    status: 'scheduled',
    scheduled_for: '2026-10-07T14:22:15Z',
    deletion_date: 'Tuesday, 7 October 2026',
    days_remaining: 28,
    cancelled: false,
    cancel_available: true,
    email_masked: 's•••@p•••.ae',
    purpose: 'scheduled_deletion_view',
    ...overrides,
  }
}

function renderDeletion(path = `/account/scheduled-deletion/${TOKEN}`) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/account/scheduled-deletion/:token"
            element={<ScheduledDeletionConfirmationPage />}
          />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/register" element={<div>Register page</div>} />
          <Route path="/account-recovery" element={<div>Recovery page</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

function baseCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acr_wf04',
    created_at: '2026-09-07T11:04:11Z',
    sla_hours_remaining: 22.97,
    sla_hours_total: 24,
    status: 'pending_review',
    reason: 'I lost access after a phishing email.',
    reason_category: 'compromised_account',
    provided: {
      preferred_channel: 'email',
      contact_masked: 's***@********.com',
      contact_full: 'sara@elitedubai.com',
      request_ip_masked: '185.104.XXX.XXX',
      request_ip_full: '185.104.212.44',
      request_user_agent_masked: 'iPhone · Safari 17',
      request_user_agent_full: 'Mozilla/5.0 (iPhone)',
    },
    on_file: {
      email_masked: 's***@********.com',
      email_full: 'sara@elitedubai.com',
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
    evidence: { file_count: 0, files: [] },
    timeline: [],
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

function sampleQueueCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acr_wf04',
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    sla_hours_remaining: 22.5,
    sla_hours_total: 24,
    status: 'pending_review',
    reason: 'Lost phone; SMS OTP no longer reaching me.',
    preferred_channel: 'email',
    contact: 'o***@********.ae',
    requested_ip: '185.104.XXX.XXX',
    agent: {
      id: 'usr_1',
      display_name_masked: 'Omar K*****',
      display_name_full: 'Omar Khoury',
      avatar_url: null,
      email_masked: 'o***@********.ae',
      email_full: 'omar.khoury@example.ae',
      phone_masked: '+971 5X XXX XX12',
      phone_full: '+971 55 123 4512',
      username_masked: 'om****23',
      username_full: 'omar_kh23',
      role: 'agent',
      agency: { id: 'agy_1', name: 'Blue Door LB', tenant_url: '/admin/tenants/agy_1' },
      plan_tier: 'broker',
    },
    evidence: { file_count: 1, files: [{ filename: 'id_front.jpg' }] },
    account_value_tier: 'standard',
    requires_two_person: false,
    is_own: false,
    env: 'live',
    ...overrides,
  }
}

function renderDetail(caseId = 'acr_wf04') {
  return render(
    <MemoryRouter initialEntries={[`/admin/support/account-recovery/${caseId}`]}>
      <Routes>
        <Route path="/admin/support/account-recovery/:caseId" element={<AccountRecoveryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderQueue(initial = '/admin/support/account-recovery') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/admin/support/account-recovery" element={<AccountRecoveryQueuePage />} />
        <Route
          path="/admin/support/account-recovery/:caseId"
          element={<div data-testid="detail-stub">detail</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WF-04 cross-loop — Phase A screens are routed and importable', () => {
  it('deletion / queue / detail page modules resolve (no invented screens)', async () => {
    const deletion = await import('@/pages/public/ScheduledDeletionConfirmationPage')
    const queue = await import('@/pages/admin/AccountRecoveryQueuePage')
    const detail = await import('@/pages/admin/AccountRecoveryDetailPage')
    expect(deletion.ScheduledDeletionConfirmationPage).toBeTypeOf('function')
    expect(queue.AccountRecoveryQueuePage).toBeTypeOf('function')
    expect(detail.AccountRecoveryDetailPage).toBeTypeOf('function')
    expect(PIIMask).toBeTypeOf('function')
  })
})

describe('WF-04 cross-loop — SHR-AUT-005d all 5 states', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('covers VALID_PENDING / ALREADY_CANCELLED / ALREADY_DELETED / INVALID_TOKEN / EXPIRED_TOKEN', async () => {
    expect(SHR_AUT_005D_STATES).toHaveLength(5)

    const cases: Array<{
      state: (typeof SHR_AUT_005D_STATES)[number]
      fetch: () => unknown
      assert: () => Promise<void> | void
    }> = [
      {
        state: 'VALID_PENDING',
        fetch: () => ({
          ok: true,
          status: 200,
          json: async () => pendingDeletion(),
          headers: new Headers(),
        }),
        assert: async () => {
          await screen.findByText('Your account is scheduled for deletion')
          expect(document.querySelector('[data-deletion-state="VALID_PENDING"]')).toBeTruthy()
        },
      },
      {
        state: 'ALREADY_CANCELLED',
        fetch: () => ({
          ok: true,
          status: 200,
          json: async () =>
            pendingDeletion({
              status: 'cancelled',
              cancelled: true,
              cancel_available: false,
              days_remaining: 0,
            }),
          headers: new Headers(),
        }),
        assert: async () => {
          await screen.findByText('This deletion has already been cancelled')
          expect(document.querySelector('[data-deletion-state="ALREADY_CANCELLED"]')).toBeTruthy()
        },
      },
      {
        state: 'ALREADY_DELETED',
        fetch: () => ({
          ok: true,
          status: 200,
          json: async () =>
            pendingDeletion({
              status: 'completed',
              cancelled: false,
              cancel_available: false,
            }),
          headers: new Headers(),
        }),
        assert: async () => {
          await screen.findByText('This account has been deleted')
          expect(document.querySelector('[data-deletion-state="ALREADY_DELETED"]')).toBeTruthy()
        },
      },
      {
        state: 'INVALID_TOKEN',
        fetch: () => ({
          ok: false,
          status: 401,
          json: async () => ({ error: 'bad', code: 'invalid_token' }),
          headers: new Headers(),
        }),
        assert: async () => {
          await screen.findByText("This link isn't valid")
          expect(document.querySelector('[data-deletion-state="INVALID_TOKEN"]')).toBeTruthy()
        },
      },
      {
        state: 'EXPIRED_TOKEN',
        fetch: () => ({
          ok: false,
          status: 410,
          json: async () => ({ error: 'expired', code: 'expired' }),
          headers: new Headers(),
        }),
        assert: async () => {
          await screen.findByText('This link has expired')
          expect(document.querySelector('[data-deletion-state="EXPIRED_TOKEN"]')).toBeTruthy()
        },
      },
    ]

    for (const c of cases) {
      cleanup()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(c.fetch()))
      renderDeletion()
      await c.assert()
    }
  })
})

describe('WF-04 cross-loop — PII reveal writes reveal-audit', () => {
  beforeEach(() => {
    cleanup()
    listMock.mockReset()
    revealQueueMock.mockReset()
    revealAuditMock.mockReset()
    revealQueueMock.mockResolvedValue({ ok: true })
    revealAuditMock.mockResolvedValue({ ok: true })
    listMock.mockResolvedValue({
      cases: [sampleQueueCase()],
      pagination: { page: 1, page_size: 25, total: 1, has_next: false },
      counts: {
        pending_review: 1,
        pending_at_risk: 0,
        high_value_awaiting_two_person: 0,
        approved_this_week: 0,
        rejected_this_week: 0,
      },
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('1024'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  })

  it('queue <PIIMask> unmask POSTs reveal-audit before plaintext appears', async () => {
    const user = userEvent.setup()
    renderQueue()
    await screen.findByText('Blue Door LB')
    expect(screen.queryByText('omar.khoury@example.ae')).toBeNull()

    const revealButtons = screen.getAllByRole('button', { name: /Reveal PII \(audited\)/i })
    await user.click(revealButtons[0])

    await waitFor(() => expect(revealQueueMock).toHaveBeenCalled())
    expect(revealQueueMock.mock.calls[0][0]).toBe('acr_wf04')
    expect(await screen.findByText('Omar Khoury')).toBeTruthy()
  })

  it('detail <PIIMask> unmask POSTs reveal-audit on every reveal', async () => {
    const user = userEvent.setup()
    getCaseMock.mockResolvedValue(baseCase())
    renderDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })
    expect(screen.queryByText('sara@elitedubai.com')).toBeNull()

    const revealButtons = screen.getAllByRole('button', { name: /Reveal PII \(audited\)/i })
    expect(revealButtons.length).toBeGreaterThan(0)
    await user.click(revealButtons[0])

    await waitFor(() => expect(revealAuditMock).toHaveBeenCalled())
    expect(revealAuditMock.mock.calls[0][0]).toBe('acr_wf04')
  })
})

describe('WF-04 cross-loop — PA-ACR-002 cast-vote only (never /approve or /reject)', () => {
  beforeEach(() => {
    cleanup()
    authMock.isAdmin = true
    authMock.agent = { id: 'pa_current', platform_role: 'platform_admin' }
    castVoteMock.mockReset()
    getCaseMock.mockReset()
    addToastMock.mockReset()
    castVoteMock.mockResolvedValue({
      success: true,
      status: 'approved',
      requires_two_person: false,
    })
    getCaseMock.mockResolvedValue(baseCase())
  })

  it('source + runtime never target legacy approve/reject', async () => {
    expect(ACCOUNT_RECOVERY_DECISION_ENDPOINT).toBe('cast-vote')
    expect(buildCastVotePath('acr_wf04')).toBe('/admin/account-recovery/acr_wf04/cast-vote')
    expect(buildCastVotePath('acr_wf04')).not.toMatch(/\/approve$|\/reject$/)

    const detailSrc = readFileSync(
      path.join(WEB_SRC, 'pages/admin/AccountRecoveryDetailPage.tsx'),
      'utf8',
    )
    const clientSrc = readFileSync(path.join(WEB_SRC, 'api/client.ts'), 'utf8')
    // No live call sites for legacy decision endpoints.
    expect(detailSrc).not.toMatch(/account-recovery\/\$\{[^}]+\}\/(approve|reject)/)
    expect(detailSrc).not.toMatch(/['"`]\/admin\/account-recovery\/[^'"`]+\/(approve|reject)/)
    expect(clientSrc).toMatch(/cast-vote/)
    expect(clientSrc).not.toMatch(
      /fetchJson\(`\/admin\/account-recovery\/\$\{[^}]+\}\/(approve|reject)/,
    )

    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })
    expect(document.querySelector('[data-decision-endpoint="cast-vote"]')).toBeTruthy()
    expect(document.body.innerHTML).not.toMatch(/account-recovery\/[^"']+\/approve/)
    expect(document.body.innerHTML).not.toMatch(/account-recovery\/[^"']+\/reject/)

    await user.click(screen.getByRole('button', { name: /Approve · Issue recovery link/i }))
    await user.click(await screen.findByRole('button', { name: /^Issue recovery link$/i }))
    await waitFor(() => expect(castVoteMock).toHaveBeenCalled())
    expect(JSON.stringify(castVoteMock.mock.calls)).not.toMatch(/\/approve|\/reject/)
  })

  it('self-approval UI guard: own-case disabled + first voter cannot double-sign', async () => {
    getCaseMock.mockResolvedValue(baseCase({ is_own: true }))
    renderDetail()
    await screen.findByText(/You can't decide your own recovery case/i)
    expect(screen.getByRole('button', { name: /Approve · Issue recovery link/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Reject$/i })).toBeDisabled()
    cleanup()

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
    renderDetail()
    await screen.findByText(/You've cast your vote/i)
    expect(screen.queryByRole('button', { name: /Approve · Issue recovery link/i })).toBeNull()
    expect(screen.getByRole('button', { name: /Withdraw my vote/i })).toBeTruthy()
    expect(screen.getByText(/A different PA must cast the second/i)).toBeTruthy()
  })

  it('disagree path surfaces escalation toast (VOTE_DISAGREEMENT)', async () => {
    const user = userEvent.setup()
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
    castVoteMock.mockRejectedValueOnce(
      Object.assign(new Error('votes disagree'), {
        status: 409,
        code: 'VOTE_DISAGREEMENT',
        escalation_case_id: 'apr_esc_1',
      }),
    )
    renderDetail()
    await user.click(await screen.findByRole('button', { name: /^Reject$/i }))
    const notes = await screen.findByLabelText(/Notes for the applicant/i)
    await user.type(notes, 'Identity documents do not match the account owner on file.')
    await user.click(screen.getByRole('button', { name: /Reject request/i }))

    await waitFor(() => expect(castVoteMock).toHaveBeenCalled())
    expect(castVoteMock).toHaveBeenCalledWith(
      'acr_wf04',
      expect.objectContaining({ vote: 'reject' }),
    )
    await waitFor(() =>
      expect(
        addToastMock.mock.calls.some((c) =>
          String(c[0]?.title || '').match(/escalated/i),
        ),
      ).toBe(true),
    )
  })
})
