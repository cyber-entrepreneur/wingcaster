// @vitest-environment jsdom
/**
 * PA-ACR-001 — Account recovery queue tests.
 * Proves PA-queue-family imports, WF-04 no-bulk deviation, filters, and masked-by-default PII.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const listMock = vi.hoisted(() => vi.fn())
const revealMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/accountRecovery', async () => {
  const actual = await vi.importActual<typeof import('@/api/accountRecovery')>(
    '@/api/accountRecovery',
  )
  return {
    ...actual,
    listAccountRecoveryCases: listMock,
    revealAccountRecoveryPii: revealMock,
    accountRecoveryCsvPath: () => '/api/admin/account-recovery.csv?mask=true',
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

vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    requireElevation: vi.fn(async () => true),
    runElevated: vi.fn(async (action: () => Promise<unknown>) => action()),
  }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { AccountRecoveryQueuePage } from './AccountRecoveryQueuePage'
import * as Queue from '@/components/queue'

const PAGE_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'AccountRecoveryQueuePage.tsx',
)

function sampleCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acr_1',
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    sla_hours_remaining: 22.5,
    sla_hours_total: 24,
    status: 'pending_review',
    reason: 'Lost phone; SMS OTP no longer reaching me on this number.',
    reason_category: 'lost_phone',
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
      agency: {
        id: 'agy_bluedoor_lb',
        name: 'Blue Door LB',
        tenant_url: '/admin/tenants/agy_bluedoor_lb',
      },
      plan_tier: 'broker',
    },
    evidence: {
      file_count: 2,
      files: [
        { filename: 'id_front.jpg', uploaded_at: '2026-09-07T12:04:20Z' },
        { filename: 'id_back.jpg', uploaded_at: '2026-09-07T12:04:35Z' },
      ],
    },
    account_value_tier: 'standard',
    requires_two_person: false,
    is_own: false,
    env: 'live',
    ...overrides,
  }
}

function mockList(cases = [sampleCase()]) {
  listMock.mockResolvedValue({
    cases,
    pagination: { page: 1, page_size: 25, total: cases.length, has_next: false },
    counts: {
      pending_review: cases.filter((c) => c.status === 'pending_review').length,
      pending_at_risk: 1,
      high_value_awaiting_two_person: 1,
      approved_this_week: 28,
      rejected_this_week: 4,
      awaiting_info_this_week: 2,
      completed_this_week: 25,
      expired_this_week: 1,
    },
  })
}

function renderPage(initial = '/admin/support/account-recovery') {
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

beforeEach(() => {
  vi.clearAllMocks()
  mockList()
  revealMock.mockResolvedValue({ ok: true })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('1024') ? true : false,
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

describe('PA-ACR-001 AccountRecoveryQueuePage', () => {
  it('imports PA-queue-family + PIIMask (source) — no local fork / no bulk bar', () => {
    const src = readFileSync(PAGE_SRC, 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/queue['"]/)
    expect(src).toMatch(/from ['"]@\/components\/security['"]/)
    for (const name of ['PAQueueFilterStrip', 'PAQueueTable', 'PAQueueKeyboardShortcutsPanel']) {
      expect(src).toContain(name)
      expect(src).not.toMatch(new RegExp(`function ${name}\\b`))
    }
    expect(src).toContain('PIIMask')
    // WF-04: bulk omitted / showBulk={false} documented
    expect(src).toMatch(/showBulk=\{false\}/)
    expect(src).toMatch(/selectable=\{false\}/)
    // Must not import or render the bulk bar (comment-only mentions of the name are ok)
    expect(src).not.toMatch(/import\s*\{[^}]*PAQueueBulkBar/)
    expect(src).not.toContain('<PAQueueBulkBar')
    expect(src).not.toContain('PAQueueBulkApproveDialog')
    expect(Queue.PAQueueFilterStrip).toBeTypeOf('function')
    expect(Queue.PAQueueTable).toBeTypeOf('function')
    expect(Queue.PAQueueKeyboardShortcutsPanel).toBeTypeOf('function')
  })

  it('renders title, env badge, and pending rows from API', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /Account recovery queue/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Environment: LIVE/i })).toBeTruthy()
    await waitFor(() => expect(listMock).toHaveBeenCalled())
    expect(await screen.findByText('Blue Door LB')).toBeTruthy()
    expect(
      screen.getByText((_, el) => {
        if (!el || el.tagName !== 'SPAN') return false
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
        return text === '2 files' || text.startsWith('2 files')
      }),
    ).toBeTruthy()
    expect(screen.queryByTestId('pa-acr-test-warning')).toBeNull()
  })

  it('defaults applicant PII to MASKED — never shows full email until reveal', async () => {
    renderPage()
    await screen.findByText('Blue Door LB')

    expect(screen.getByText('o***@********.ae')).toBeTruthy()
    expect(screen.queryByText('omar.khoury@example.ae')).toBeNull()
    expect(screen.getByText('Omar K*****')).toBeTruthy()
    expect(screen.queryByText('Omar Khoury')).toBeNull()

    // No selection checkboxes (bulk omitted)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('reveal requires click + reveal-audit POST before unmask', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Blue Door LB')

    const revealButtons = screen.getAllByRole('button', { name: /Reveal PII \(audited\)/i })
    expect(revealButtons.length).toBeGreaterThan(0)
    await user.click(revealButtons[0])

    await waitFor(() => expect(revealMock).toHaveBeenCalled())
    expect(revealMock.mock.calls[0][0]).toBe('acr_1')
    // After successful audit, plaintext name appears
    expect(await screen.findByText('Omar Khoury')).toBeTruthy()
  })

  it('blocks reveal when audit fails — stays masked', async () => {
    const user = userEvent.setup()
    revealMock.mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
    renderPage()
    await screen.findByText('Blue Door LB')

    const revealButtons = screen.getAllByRole('button', { name: /Reveal PII \(audited\)/i })
    await user.click(revealButtons[0])

    await waitFor(() => expect(revealMock).toHaveBeenCalled())
    expect(screen.queryByText('Omar Khoury')).toBeNull()
    expect(screen.getByText('Omar K*****')).toBeTruthy()
  })

  it('wires status / tier / channel / within filters into list query', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(listMock).toHaveBeenCalled())
    const firstCall = listMock.mock.calls[0][0]
    expect(firstCall).toMatchObject({
      status: 'pending_review',
      within: '7d',
      page: 1,
      pageSize: 25,
    })

    listMock.mockClear()
    mockList([])

    await user.selectOptions(screen.getByLabelText(/Account tier/i), 'high_value')
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'high_value', status: 'pending_review' }),
      ),
    )

    listMock.mockClear()
    mockList([])
    await user.selectOptions(screen.getByLabelText(/Preferred channel/i), 'whatsapp')
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ channel: 'whatsapp' })),
    )

    listMock.mockClear()
    mockList([])
    await user.selectOptions(screen.getByLabelText(/Submitted within/i), '24h')
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ within: '24h' })),
    )
  })

  it('status tab swap refetches with new status', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Blue Door LB')
    listMock.mockClear()
    mockList([])

    await user.click(screen.getByRole('tab', { name: /Approved/i }))
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' })),
    )
  })

  it('row Open navigates to detail deep-link for Agent 3', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Blue Door LB')
    await user.click(screen.getByRole('button', { name: /^Open$/i }))
    expect(await screen.findByTestId('detail-stub')).toBeTruthy()
  })

  it('empty pending state shows decisions CTA', async () => {
    mockList([])
    renderPage()
    expect(await screen.findByText(/No recovery cases awaiting review/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Review recent decisions/i })).toBeTruthy()
  })

  it('keyboard ? opens shortcuts panel with WF-04 map (no bulk select)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Blue Door LB')
    await user.keyboard('?')
    const dialog = await screen.findByRole('dialog', { name: /Keyboard shortcuts/i })
    expect(within(dialog).getByText(/Reveal PII/i)).toBeTruthy()
    expect(within(dialog).getByText(/open focused case in new tab/i)).toBeTruthy()
    expect(within(dialog).queryByText(/Toggle row selection/i)).toBeNull()
    expect(within(dialog).queryByText(/Select all visible/i)).toBeNull()
  })

  it('does not pre-reveal via URL query params', async () => {
    renderPage('/admin/support/account-recovery?reveal=1&unmask=email')
    await screen.findByText('Blue Door LB')
    expect(screen.queryByText('omar.khoury@example.ae')).toBeNull()
    expect(screen.getByText('o***@********.ae')).toBeTruthy()
    expect(revealMock).not.toHaveBeenCalled()
  })
})
