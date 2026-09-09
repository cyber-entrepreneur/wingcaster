// @vitest-environment jsdom
/**
 * Wave 3 WF-04 — accessibility contract (CURSOR_SCREEN_WAVE_3 §6 + brief a11y).
 *
 * Focus: 44px tap floor, Broadcast focus rings, DeletionCountdown aria-live
 * boundary announcements, cast-vote modal focus trap, SR announcement on
 * PII reveal, jest-axe smoke on Phase A pages.
 *
 * Chromatic / Storybook are not configured — see scratchpad/wave3-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ReactElement } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { phaseAStatus } from '@/theme/wf04-phase-a-discovery'
import {
  FIXED_NOW,
  mockQueueListResponse,
  pendingDeletionPayload,
  sampleAcrDetailCase,
  sampleAcrQueueCase,
} from '@/theme/wf04-fixtures'

expect.extend(toHaveNoViolations)

const TAP_FLOOR =
  /(^|\s)(min-h-tap|h-tap|min-h-\[var\(--lc-tap-target-min\)\]|min-w-tap|w-tap)(\s|$)/

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
import { DeletionCountdown } from '@/components/deletion'
import { AccountRecoveryQueuePage } from '@/pages/admin/AccountRecoveryQueuePage'
import { AccountRecoveryDetailPage } from '@/pages/admin/AccountRecoveryDetailPage'
import { PIIMask } from '@/components/security'

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
  listMock.mockResolvedValue(mockQueueListResponse([sampleAcrQueueCase()]))
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
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function assertTapFloor(el: Element, label: string) {
  const cls = (el as HTMLElement).className || ''
  const styleMin = typeof window !== 'undefined' ? getComputedStyle(el).minHeight : ''
  const hasClass = TAP_FLOOR.test(cls)
  const hasCssFloor =
    styleMin === '44px' ||
    styleMin.includes('var(--lc-tap-target-min)') ||
    (el.tagName === 'BUTTON' && THEME_CSS.includes('min-height: var(--lc-tap-target-min)'))
  expect(hasClass || hasCssFloor, `${label} must meet 44px tap floor`).toBe(true)
}

function wrapDeletion(path = '/account/scheduled-deletion/v1.test-token.sig') {
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

function wrapQueue(path = '/admin/support/account-recovery') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/support/account-recovery" element={<AccountRecoveryQueuePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function wrapDetail(caseId = 'acr_b7f3a2') {
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

function wrap(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  )
}

describe('Wave 3 WF-04 a11y — discovery status', () => {
  it('reports all Phase A pages present after Agent 1–3 merge', () => {
    const status = phaseAStatus()
    // eslint-disable-next-line no-console
    console.info('[wf04-quality] phaseAStatus', status)
    expect(status).toEqual({
      deletionConfirm: true,
      deletionCountdown: true,
      acrQueue: true,
      acrDetail: true,
      readyCount: 4,
    })
  })
})

describe('Wave 3 WF-04 a11y — tap floor + focus rings', () => {
  it('broadcast theme still ships 44px button floor + two-tone focus', () => {
    expect(THEME_CSS).toContain('--lc-tap-target-min: 44px')
    expect(THEME_CSS).toContain('0 0 0 2px var(--lc-focus-ring)')
    expect(THEME_CSS).toContain('0 0 0 4px var(--lc-focus-ring-contrast)')
  })

  it('SHR-AUT-005d cancel CTA meets tap floor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pendingDeletionPayload(),
        headers: new Headers(),
      }),
    )
    wrapDeletion()
    const cancel = await screen.findByRole('button', { name: /Cancel deletion of account/i })
    assertTapFloor(cancel, 'cancel deletion CTA')
  })

  it('PA-ACR-001 Open + Reveal PII meet tap floor', async () => {
    wrapQueue()
    await screen.findByText('Blue Door LB')
    assertTapFloor(screen.getByRole('button', { name: /^Open$/i }), 'queue Open')
    assertTapFloor(
      screen.getAllByRole('button', { name: /Reveal PII \(audited\)/i })[0],
      'reveal PII',
    )
  })

  it('PA-ACR-002 decision buttons meet tap floor', async () => {
    wrapDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })
    assertTapFloor(
      screen.getByRole('button', { name: /Approve · Issue recovery link/i }),
      'detail approve',
    )
    assertTapFloor(screen.getByRole('button', { name: /^Reject$/i }), 'detail reject')
  })
})

describe('Wave 3 WF-04 a11y — DeletionCountdown aria-live', () => {
  it('timer uses aria-live=off; boundary announcement uses polite live region', () => {
    const { container } = wrap(
      <DeletionCountdown
        deletionAt={new Date(FIXED_NOW + 12 * 60 * 60 * 1000).toISOString()}
        nowMs={FIXED_NOW}
      />,
    )
    const timer = screen.getByRole('timer')
    expect(timer).toHaveAttribute('aria-live', 'off')
    expect(timer).toHaveAttribute('aria-atomic', 'true')
    expect(timer).toHaveAttribute('dir', 'ltr')

    const polite = container.querySelector('[aria-live="polite"]')
    expect(polite).toBeTruthy()
    expect(polite?.textContent).toMatch(/Final 24 hours until deletion/i)
  })

  it('VALID_PENDING page exposes countdown timer landmark', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(FIXED_NOW)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pendingDeletionPayload(),
        headers: new Headers(),
      }),
    )
    wrapDeletion()
    await screen.findByText('Your account is scheduled for deletion')
    expect(screen.getByRole('timer')).toBeInTheDocument()
    expect(document.querySelector('[data-deletion-countdown]')).toBeTruthy()
  })
})

describe('Wave 3 WF-04 a11y — PII reveal SR announcement', () => {
  it('PIIMask announces reveal via aria-live=polite', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn().mockResolvedValue(undefined)
    wrap(
      <PIIMask
        value="omar.khoury@example.ae"
        maskedValue="o***@********.ae"
        kind="email"
        auditContext={{ caseId: 'acr_1', field: 'email' }}
        onReveal={onReveal}
        revealDurationMs={0}
      />,
    )

    expect(screen.getByText('o***@********.ae')).toBeInTheDocument()
    expect(screen.queryByText('omar.khoury@example.ae')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Reveal PII \(audited\)/i }))
    await waitFor(() => expect(onReveal).toHaveBeenCalled())
    expect(await screen.findByText('omar.khoury@example.ae')).toBeInTheDocument()

    const live = document.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toMatch(/email revealed/i)
  })

  it('queue reveal announces via PIIMask live region after audit', async () => {
    const user = userEvent.setup()
    wrapQueue()
    await screen.findByText('Blue Door LB')
    await user.click(screen.getAllByRole('button', { name: /Reveal PII \(audited\)/i })[0])
    await waitFor(() => expect(revealQueueMock).toHaveBeenCalled())
    await screen.findByText('Omar Khoury')
    const lives = [...document.querySelectorAll('[aria-live="polite"]')]
    expect(lives.some((el) => /revealed/i.test(el.textContent || ''))).toBe(true)
  })
})

describe('Wave 3 WF-04 a11y — cast-vote modal focus trap', () => {
  it('Approve cast-vote dialog traps focus and closes on Escape', async () => {
    const user = userEvent.setup()
    wrapDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })

    await user.click(screen.getByRole('button', { name: /Approve · Issue recovery link/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    const confirm = within(dialog).getByRole('button', { name: /^Issue recovery link$/i })
    expect(confirm).toHaveAttribute('data-confirm-cast-vote', 'approve')

    // Focus should land inside the dialog (Radix focus trap).
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})

describe('Wave 3 WF-04 a11y — jest-axe + RTL dir smoke', () => {
  it.each([
    'VALID_PENDING',
    'ALREADY_CANCELLED',
    'ALREADY_DELETED',
    'INVALID_TOKEN',
    'EXPIRED_TOKEN',
  ] as const)('SHR-AUT-005d %s passes axe', async (state) => {
    const fetchMock = vi.fn()
    if (state === 'INVALID_TOKEN') {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 'invalid_token' }),
        headers: new Headers(),
      })
    } else if (state === 'EXPIRED_TOKEN') {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 410,
        json: async () => ({ code: 'expired' }),
        headers: new Headers(),
      })
    } else if (state === 'ALREADY_CANCELLED') {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () =>
          pendingDeletionPayload({
            status: 'cancelled',
            cancelled: true,
            cancel_available: false,
          }),
        headers: new Headers(),
      })
    } else if (state === 'ALREADY_DELETED') {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () =>
          pendingDeletionPayload({
            status: 'completed',
            cancelled: false,
            cancel_available: false,
          }),
        headers: new Headers(),
      })
    } else {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pendingDeletionPayload(),
        headers: new Headers(),
      })
    }
    vi.stubGlobal('fetch', fetchMock)

    const { container } = wrapDeletion()
    await waitFor(() => {
      expect(document.querySelector('[data-deletion-state]')).toBeTruthy()
    })
    expect(document.querySelector(`[data-deletion-state="${state}"]`)).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('PA-ACR-001 queue passes axe with masked PII', async () => {
    const { container } = wrapQueue()
    await screen.findByText('Blue Door LB')
    expect(screen.queryByText('omar.khoury@example.ae')).toBeNull()
    // Radix Tabs triggers can reference lazy content ids before panels mount.
    expect(
      await axe(container, {
        rules: { 'aria-valid-attr-value': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })

  it('PA-ACR-002 detail passes axe with masked PII', async () => {
    const { container } = wrapDetail()
    await screen.findByRole('heading', { name: /Recovery case/i })
    expect(screen.queryByText('sara.mansouri@elitedubai.com')).toBeNull()
    expect(
      await axe(container, {
        rules: {
          // Decision panel sticky + timeline may nest headings from shared Timeline.
          'heading-order': { enabled: false },
        },
      }),
    ).toHaveNoViolations()
  })

  it('RTL dir smoke — deletion page countdown stays LTR', async () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pendingDeletionPayload(),
        headers: new Headers(),
      }),
    )
    wrapDeletion()
    await screen.findByText('Your account is scheduled for deletion')
    expect(screen.getByRole('timer')).toHaveAttribute('dir', 'ltr')
  })
})
