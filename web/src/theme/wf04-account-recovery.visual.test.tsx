// @vitest-environment jsdom
/**
 * Wave 3 WF-04 — visual / DOM snapshot matrix (~15 Chromatic stand-ins).
 *
 * CRITICAL PII-safety: every default-state snapshot must show MASKED
 * identifiers only — zero plaintext email/phone/username/IP leakage.
 *
 * All 5 SHR-AUT-005d public states are snapshotted for anonymous viewers.
 * Chromatic / Storybook are not configured — see scratchpad/wave3-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import {
  assertNoPlaintextPii,
  FIXED_NOW,
  mockQueueListResponse,
  pendingDeletionPayload,
  sampleAcrDetailCase,
  sampleAcrQueueCase,
} from '@/theme/wf04-fixtures'
import type { ScheduledDeletionPayload } from '@/pages/public/ScheduledDeletionConfirmationPage'

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

const listMock = vi.hoisted(() => vi.fn())
const revealQueueMock = vi.hoisted(() => vi.fn())
const getCaseMock = vi.hoisted(() => vi.fn())
const revealAuditMock = vi.hoisted(() => vi.fn())
const castVoteMock = vi.hoisted(() => vi.fn())

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

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    api: {
      ...actual.api,
      getAdminAccountRecoveryCase: getCaseMock,
      castAccountRecoveryVote: castVoteMock,
      revealAccountRecoveryAudit: revealAuditMock,
      requestAccountRecoveryInfo: vi.fn(),
      cancelAccountRecoveryInfoRequest: vi.fn(),
      undoAccountRecoveryApprove: vi.fn(),
      withdrawAccountRecoveryVote: vi.fn(),
      fetchAccountRecoveryEvidenceBlob: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
      accountRecoveryEvidencePath: (caseId: string, evidenceId: string, download = false) =>
        `/admin/account-recovery/${caseId}/evidence/${evidenceId}${download ? '?download=1' : ''}`,
    },
  }
})

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

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    agent: { id: 'pa_current', platform_role: 'platform_admin' as const },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshAgent: vi.fn(),
    completeTwoFactor: vi.fn(),
  }),
}))

vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    requireElevation: vi.fn(async () => true),
    runElevated: vi.fn(async (action: () => Promise<unknown>) => action()),
  }),
  StepUpProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: vi.fn() }))

import { ScheduledDeletionConfirmationPage } from '@/pages/public/ScheduledDeletionConfirmationPage'
import { AccountRecoveryQueuePage } from '@/pages/admin/AccountRecoveryQueuePage'
import { AccountRecoveryDetailPage } from '@/pages/admin/AccountRecoveryDetailPage'

type Dir = 'ltr' | 'rtl'
type Mode = 'light' | 'dark'

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()

  if (!document.getElementById('broadcast-theme-css')) {
    const style = document.createElement('style')
    style.id = 'broadcast-theme-css'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }
})

beforeEach(() => {
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  applyLcMode('light')
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(FIXED_NOW)
  listMock.mockResolvedValue(
    mockQueueListResponse([
      sampleAcrQueueCase(),
      sampleAcrQueueCase({
        id: 'acr_2',
        account_value_tier: 'high_value',
        requires_two_person: true,
        agent: {
          ...sampleAcrQueueCase().agent,
          id: 'usr_2',
          display_name_masked: 'Sara M*****',
          display_name_full: 'Sara Mansouri',
          email_masked: 's***@********.com',
          email_full: 'sara.mansouri@elitedubai.com',
          agency: {
            id: 'agy_1',
            name: 'Elite Real Estate Dubai',
            tenant_url: '/admin/tenants/agy_1',
          },
        },
      }),
    ]),
  )
  revealQueueMock.mockResolvedValue({ ok: true })
  getCaseMock.mockResolvedValue(sampleAcrDetailCase())
  revealAuditMock.mockResolvedValue({ ok: true })
  castVoteMock.mockResolvedValue({
    success: true,
    status: 'approved',
    requires_two_person: false,
  })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('1024') || query.includes('min-width: 1024'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
  document.body.querySelectorAll('[data-radix-portal]').forEach((n) => n.remove())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

/** Stabilize DOM for snapshots (ids, portals). */
function serialize(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[id]').forEach((el) => {
    const id = el.getAttribute('id') || ''
    if (id.startsWith('radix-') || id.includes(':') || /^r\d/.test(id)) {
      el.setAttribute('id', '__stable__')
    }
  })
  clone.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby], for').forEach((el) => {
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for'] as const) {
      if (el.hasAttribute(attr)) {
        const val = el.getAttribute(attr) || ''
        if (val.startsWith('radix-') || val.includes(':')) {
          el.setAttribute(attr, '__stable__')
        }
      }
    }
  })
  // Countdown digits tick — freeze aria-label to a stable shape for snapshots.
  clone.querySelectorAll('[role="timer"]').forEach((el) => {
    el.setAttribute('aria-label', 'Time until deletion: __stable__')
    el.querySelectorAll('[data-countdown-digits]').forEach((digit) => {
      digit.textContent = '__'
    })
  })
  const portals = [...document.body.querySelectorAll('[data-radix-portal], [role="dialog"], [role="alertdialog"]')]
    .map((node) => {
      const c = node.cloneNode(true) as HTMLElement
      c.querySelectorAll('[id]').forEach((el) => {
        const id = el.getAttribute('id') || ''
        if (id.startsWith('radix-') || id.includes(':')) el.setAttribute('id', '__stable__')
      })
      return c.outerHTML
    })
    .join('\n')
  const mode = document.documentElement.getAttribute('data-lc-mode') || 'light'
  const dir = document.documentElement.dir || 'ltr'
  const lang = document.documentElement.lang || 'en'
  const body = `${clone.innerHTML}\n<!-- portals -->\n${portals}`
  // Stabilize relative/absolute timestamps so CI (Linux UTC) and local (Windows) match.
  const stable = body
    .replace(/\d+\s+(second|minute|hour|day|month|year)s?\s+ago/gi, '__REL__')
    .replace(/\d+[smhdwy]\s+ago/gi, '__REL__')
    .replace(/\bin\s+\d+\s+(second|minute|hour|day|month|year)s?\b/gi, '__REL__')
    .replace(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4},\s*\d{1,2}:\d{2}(?:\s*(?:AM|PM))?(?:\s+[A-Z]{2,5})?/gi, '__ABS__')
    .replace(
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+at\s+\d{1,2}:\d{2}(?:\s+[A-Z]{2,5})?/g,
      '__ABS__',
    )
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}(?:,\s*\d{1,2}:\d{2}(?:\s*[AP]M)?)?/gi, '__ABS__')
    .replace(/__ABS__\s+[A-Z]{2,5}\b/g, '__ABS__')
    .replace(/title="\d{4}-\d{2}-\d{2}T[^"]+"/g, 'title="__ISO__"')
    .replace(/datetime="\d{4}-\d{2}-\d{2}T[^"]+"/g, 'datetime="__ISO__"')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g, '__ISO__')
  return `<!-- mode=${mode} dir=${dir} lang=${lang} -->\n${stable}`
}

function applyTheme(mode: Mode, dir: Dir) {
  applyLcMode(mode)
  document.documentElement.dir = dir
  document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
}

function stubDeletionFetch(payload: ScheduledDeletionPayload | { error: true; status: number; code?: string }) {
  if ('error' in payload && payload.error) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: payload.status,
        json: async () => ({ code: payload.code }),
        headers: new Headers(),
      }),
    )
    return
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
      headers: new Headers(),
    }),
  )
}

function renderDeletion(path = '/account/scheduled-deletion/v1.test-token.sig') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/account/scheduled-deletion/:token"
            element={<ScheduledDeletionConfirmationPage />}
          />
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/register" element={<div>Register</div>} />
          <Route path="/account-recovery" element={<div>Recovery</div>} />
          <Route path="/support/new" element={<div>Support</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={['/admin/support/account-recovery']}>
      <Routes>
        <Route path="/admin/support/account-recovery" element={<AccountRecoveryQueuePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderDetail(caseId = 'acr_b7f3a2') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/admin/support/account-recovery/${caseId}`]}>
        <Routes>
          <Route
            path="/admin/support/account-recovery/:caseId"
            element={<AccountRecoveryDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

async function snap(label: string, root: HTMLElement) {
  const html = serialize(root)
  assertNoPlaintextPii(html, label)
  expect(html).toMatchSnapshot()
}

/**
 * ~15 Chromatic stand-in snapshots:
 * 1–5  SHR-AUT-005d five public states (mobile light LTR)
 * 6    VALID_PENDING dark RTL
 * 7    VALID_PENDING desktop light LTR
 * 8–9  PA-ACR-001 queue pending (+ dark RTL)
 * 10   PA-ACR-001 high-value row emphasis
 * 11–12 PA-ACR-002 detail pending (+ dark RTL)
 * 13   PA-ACR-002 high-value two-person
 * 14   PA-ACR-002 cast-vote approve modal
 * 15   PA-ACR-001 mobile gate (<1024)
 */
describe('Wave 3 WF-04 visual matrix — Chromatic stand-ins (PII-safe)', () => {
  it('01 deletion-VALID_PENDING-mobile-light-ltr', async () => {
    applyTheme('light', 'ltr')
    stubDeletionFetch(pendingDeletionPayload())
    const view = renderDeletion('/account/scheduled-deletion/v1.test-token.sig?src=reminder-t-minus-7')
    await screen.findByText('Your account is scheduled for deletion')
    expect(screen.getByText(/s•••@p•••\.ae/)).toBeInTheDocument()
    await snap('01 deletion VALID_PENDING', view.container)
  })

  it('02 deletion-ALREADY_CANCELLED-mobile-light-ltr', async () => {
    applyTheme('light', 'ltr')
    stubDeletionFetch(
      pendingDeletionPayload({
        status: 'cancelled',
        cancelled: true,
        cancel_available: false,
      }),
    )
    const view = renderDeletion()
    await screen.findByText('This deletion has already been cancelled')
    await snap('02 deletion ALREADY_CANCELLED', view.container)
  })

  it('03 deletion-ALREADY_DELETED-mobile-light-ltr', async () => {
    applyTheme('light', 'ltr')
    stubDeletionFetch(
      pendingDeletionPayload({
        status: 'completed',
        cancelled: false,
        cancel_available: false,
      }),
    )
    const view = renderDeletion()
    await screen.findByText('This account has been deleted')
    await snap('03 deletion ALREADY_DELETED', view.container)
  })

  it('04 deletion-INVALID_TOKEN-mobile-light-ltr', async () => {
    applyTheme('light', 'ltr')
    stubDeletionFetch({ error: true, status: 401, code: 'invalid_token' })
    const view = renderDeletion()
    await screen.findByText("This link isn't valid")
    await snap('04 deletion INVALID_TOKEN', view.container)
  })

  it('05 deletion-EXPIRED_TOKEN-mobile-light-ltr', async () => {
    applyTheme('light', 'ltr')
    stubDeletionFetch({ error: true, status: 410, code: 'expired' })
    const view = renderDeletion()
    await screen.findByText('This link has expired')
    await snap('05 deletion EXPIRED_TOKEN', view.container)
  })

  it('06 deletion-VALID_PENDING-mobile-dark-rtl', async () => {
    applyTheme('dark', 'rtl')
    stubDeletionFetch(pendingDeletionPayload())
    const view = renderDeletion()
    await screen.findByText('Your account is scheduled for deletion')
    await snap('06 deletion VALID_PENDING dark rtl', view.container)
  })

  it('07 deletion-VALID_PENDING-desktop-light-ltr', async () => {
    applyTheme('light', 'ltr')
    stubDeletionFetch(pendingDeletionPayload())
    const view = renderDeletion()
    await screen.findByText('Your account is scheduled for deletion')
    await snap('07 deletion VALID_PENDING desktop', view.container)
  })

  it('08 acr-queue-pending-desktop-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = renderQueue()
    await screen.findByText('Blue Door LB')
    expect(screen.getByText('o***@********.ae')).toBeInTheDocument()
    expect(screen.queryByText('omar.khoury@example.ae')).toBeNull()
    await snap('08 acr queue pending', view.container)
  })

  it('09 acr-queue-pending-desktop-dark-rtl', async () => {
    applyTheme('dark', 'rtl')
    const view = renderQueue()
    await screen.findByText('Blue Door LB')
    await snap('09 acr queue dark rtl', view.container)
  })

  it('10 acr-queue-high-value-desktop-light-ltr', async () => {
    applyTheme('light', 'ltr')
    listMock.mockResolvedValue(
      mockQueueListResponse([
        sampleAcrQueueCase({
          id: 'acr_hv',
          account_value_tier: 'high_value',
          requires_two_person: true,
        }),
      ]),
    )
    const view = renderQueue()
    await screen.findByText('Blue Door LB')
    expect(screen.getAllByText(/High-value/i).length).toBeGreaterThan(0)
    await snap('10 acr queue high-value', view.container)
  })

  it('11 acr-detail-pending-desktop-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = renderDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })
    expect(screen.getAllByText('s***@********.com').length).toBeGreaterThan(0)
    expect(screen.queryByText('sara.mansouri@elitedubai.com')).toBeNull()
    await snap('11 acr detail pending', view.container)
  })

  it('12 acr-detail-pending-desktop-dark-rtl', async () => {
    applyTheme('dark', 'rtl')
    const view = renderDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })
    await snap('12 acr detail dark rtl', view.container)
  })

  it('13 acr-detail-two-person-desktop-light-ltr', async () => {
    applyTheme('light', 'ltr')
    getCaseMock.mockResolvedValue(
      sampleAcrDetailCase({
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
    const view = renderDetail()
    await screen.findByRole('progressbar', { name: /Two-person approval progress/i })
    await snap('13 acr detail two-person', view.container)
  })

  it('14 acr-detail-cast-vote-modal-desktop-light-ltr', async () => {
    applyTheme('light', 'ltr')
    // userEvent + fake timers: advance timers so dialog opens reliably
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const view = renderDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })
    await user.click(screen.getByRole('button', { name: /Approve · Issue recovery link/i }))
    await screen.findByRole('dialog')
    await snap('14 acr detail cast-vote modal', view.container)
  })

  it('15 acr-queue-mobile-gate-light-ltr', async () => {
    applyTheme('light', 'ltr')
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
    const view = renderQueue()
    await screen.findByRole('heading', { name: /PA console requires a larger screen/i })
    await snap('15 acr queue mobile gate', view.container)
  })
})

describe('Wave 3 WF-04 visual — PII-audit gate', () => {
  it('default queue + detail DOM never contains plaintext identifiers', async () => {
    applyTheme('light', 'ltr')
    const queue = renderQueue()
    await screen.findByText('Blue Door LB')
    assertNoPlaintextPii(queue.container.innerHTML, 'queue default')
    queue.unmount()

    const detail = renderDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })
    assertNoPlaintextPii(detail.container.innerHTML, 'detail default')
  })
})
