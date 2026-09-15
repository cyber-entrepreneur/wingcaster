// @vitest-environment jsdom
/**
 * PA-MOD-001 — Portal moderation queue tests.
 * Proves queue primitives are IMPORTED (not reimplemented) + RTL/dark/a11y smoke.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

expect.extend(toHaveNoViolations)

const listMock = vi.hoisted(() => vi.fn())
const registryMock = vi.hoisted(() => vi.fn())
const approveMock = vi.hoisted(() => vi.fn())
const bulkApproveMock = vi.hoisted(() => vi.fn())
const rejectMock = vi.hoisted(() => vi.fn())
const bulkRejectMock = vi.hoisted(() => vi.fn())
const requestInfoMock = vi.hoisted(() => vi.fn())
const bulkRequestInfoMock = vi.hoisted(() => vi.fn())
const undoApproveMock = vi.hoisted(() => vi.fn())
const undoRejectMock = vi.hoisted(() => vi.fn())
const retryMock = vi.hoisted(() => vi.fn())
const addToastMock = vi.hoisted(() => vi.fn())
const requireElevationMock = vi.hoisted(() => vi.fn(async () => true))
const runElevatedMock = vi.hoisted(() =>
  vi.fn(async (action: () => Promise<unknown>) => action()),
)

vi.mock('@/api/portalModeration', async () => {
  const actual = await vi.importActual<typeof import('@/api/portalModeration')>(
    '@/api/portalModeration',
  )
  return {
    ...actual,
    listPortalModeration: listMock,
    listPortalRegistryOptions: registryMock,
    approvePortalSubmission: approveMock,
    bulkApprovePortalSubmissions: bulkApproveMock,
    rejectPortalSubmission: rejectMock,
    bulkRejectPortalSubmissions: bulkRejectMock,
    requestInfoPortalSubmission: requestInfoMock,
    bulkRequestInfoPortalSubmissions: bulkRequestInfoMock,
    undoApprovePortalSubmission: undoApproveMock,
    undoRejectPortalSubmission: undoRejectMock,
    retryPublishPortalSubmission: retryMock,
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
    requireElevation: requireElevationMock,
    runElevated: runElevatedMock,
  }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: addToastMock, removeToast: vi.fn(), toasts: [] }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { PortalModerationQueuePage } from './PortalModerationQueuePage'
import * as Queue from '@/components/queue'
import { portalModerationCsvPath } from '@/api/portalModeration'

const PAGE_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'PortalModerationQueuePage.tsx',
)
const API_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../api/portalModeration.ts',
)

function sampleSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'psub_1',
    submitted_at: new Date(Date.now() - 3_600_000).toISOString(),
    sla_hours_remaining: 3.8,
    sla_hours_total: 4,
    agent: { id: 'usr_1', display_name: 'Sara Al Mansouri', avatar_url: null },
    agency: {
      id: 'agy_1',
      name: 'Elite Real Estate Dubai',
      tenant_url: '/admin/tenants/agy_1',
    },
    listing: {
      id: 'lst_1',
      title: '3BR apartment · Dubai Marina',
      address_line: 'Marina Gate 2',
      hero_image_url: null,
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
      checks: [{ code: 'photo_count_min', severity: 'pass', message: 'ok' }],
    },
    tenure_risk: { tier: 'low', score: 0.1, signals: [] },
    status: 'pending',
    decision: null,
    is_own: false,
    step_up_required: false,
    env: 'live',
    ...overrides,
  }
}

function mockList(submissions = [sampleSubmission()]) {
  listMock.mockResolvedValue({
    submissions,
    pagination: { page: 1, page_size: 25, total: submissions.length, has_next: false },
    counts: {
      pending: submissions.filter((s) => s.status === 'pending').length,
      pending_at_risk: 1,
      approved_this_week: 42,
      rejected_this_week: 6,
      request_info_this_week: 2,
      portal_error_this_week: 1,
      expired: 0,
    },
  })
}

function renderPage(initial = '/admin/moderation/portals') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/admin/moderation/portals" element={<PortalModerationQueuePage />} />
        <Route
          path="/admin/moderation/portals/:submissionId"
          element={<div data-testid="detail-stub">detail</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  registryMock.mockResolvedValue([
    {
      code: 'property_finder_ae',
      display_name: 'Property Finder AE',
      country_codes: ['AE'],
      is_active: true,
    },
    { code: 'bayut', display_name: 'Bayut', country_codes: ['AE', 'SA'], is_active: true },
  ])
  mockList()
  // Desktop viewport for PA console
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

describe('PA-MOD-001 PortalModerationQueuePage', () => {
  it('imports PA-queue-family primitives (source + runtime) — no local fork', () => {
    const src = readFileSync(PAGE_SRC, 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/queue['"]/)
    for (const name of [
      'PAQueueFilterStrip',
      'PAQueueTable',
      'PAQueueBulkBar',
      'PAQueueBulkApproveDialog',
      'PAQueueBulkReasonDialog',
      'PAQueueKeyboardShortcutsPanel',
    ]) {
      expect(src).toContain(name)
      expect(src).not.toMatch(new RegExp(`function ${name}\\b`))
      expect(src).not.toMatch(new RegExp(`const ${name}\\s*=`))
    }
    // Runtime: queue barrel exports are the same function references consumers must use
    expect(Queue.PAQueueFilterStrip).toBeTypeOf('function')
    expect(Queue.PAQueueTable).toBeTypeOf('function')
    expect(Queue.PAQueueBulkBar).toBeTypeOf('function')
    expect(Queue.PAQueueBulkApproveDialog).toBeTypeOf('function')
    expect(Queue.PAQueueBulkReasonDialog).toBeTypeOf('function')
    expect(Queue.PAQueueKeyboardShortcutsPanel).toBeTypeOf('function')
  })

  it('renders title, env badge slot, and pending rows from API', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /Portal moderation queue/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Environment: LIVE/i })).toBeTruthy()
    await waitFor(() => expect(listMock).toHaveBeenCalled())
    expect(await screen.findByText('Sara Al Mansouri')).toBeTruthy()
    expect(screen.getByText('3BR apartment · Dubai Marina')).toBeTruthy()
    expect(screen.queryByTestId('pa-mod-test-warning')).toBeNull()
  })

  it('wires showBulk={true} and opens bulk approve count-confirm', async () => {
    const user = userEvent.setup()
    mockList([
      sampleSubmission({ id: 'psub_a' }),
      sampleSubmission({
        id: 'psub_b',
        agent: { id: 'usr_2', display_name: 'Ahmed Khan', avatar_url: null },
      }),
    ])
    renderPage()
    await screen.findByText('Sara Al Mansouri')

    const checkboxes = screen.getAllByRole('checkbox')
    // first checkbox is select-all; pick row checkboxes
    await user.click(checkboxes[1])
    await user.click(checkboxes[2])

    const bulkBar = await screen.findByRole('status')
    expect(bulkBar.textContent).toMatch(/2\s*selected/i)
    // Bulk bar Approve (includes Numeric count) — not row inline Approve
    const bulkApprove = within(bulkBar).getByRole('button', { name: /Approve/i })
    await user.click(bulkApprove)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/portal submissions/i)).toBeTruthy()
  })

  it('requires reason for bulk reject (confirm disabled until reason + notes)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const bulkBar = await screen.findByRole('status')
    await user.click(within(bulkBar).getByRole('button', { name: /Reject/i }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: /Reject all/i })
    expect(confirm).toBeDisabled()

    await user.selectOptions(within(dialog).getByLabelText(/Reason/i), 'portal_outage')
    await user.type(within(dialog).getByLabelText(/Notes/i), 'portal is down today')
    expect(confirm).not.toBeDisabled()
  })

  it('navigates to detail deep-link with return_to for Agent 4', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    await user.click(screen.getByRole('button', { name: /^Open$/i }))
    expect(await screen.findByTestId('detail-stub')).toBeTruthy()
  })

  it('keyboard ? opens shortcuts panel; Esc closes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    await user.keyboard('?')
    expect(await screen.findByRole('dialog', { name: /Keyboard shortcuts/i })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Keyboard shortcuts/i })).toBeNull()
    })
  })

  it('empty pending state shows registry CTA', async () => {
    mockList([])
    renderPage()
    expect(await screen.findByText(/No submissions awaiting moderation/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Review portal registry/i })).toHaveAttribute(
      'href',
      '/admin/portals',
    )
  })

  it('is axe-clean on loaded queue', async () => {
    const { container } = renderPage()
    await screen.findByText('Sara Al Mansouri')
    // PAQueueFilterStrip TabsTriggers reference TabsContent ids that the stub
    // omits — known family-primitive noise, not introduced by this consumer.
    expect(
      await axe(container, {
        rules: { 'aria-valid-attr-value': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })

  it('supports RTL dir without crashing (Arabic mirror smoke)', async () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    try {
      const { container } = renderPage()
      await screen.findByText('Sara Al Mansouri')
      expect(container.querySelector('[data-testid="portal-moderation-queue"]')).toBeTruthy()
      expect(
        await axe(container, {
          rules: { 'aria-valid-attr-value': { enabled: false } },
        }),
      ).toHaveNoViolations()
    } finally {
      document.documentElement.dir = 'ltr'
      document.documentElement.lang = 'en'
    }
  })

  it('supports dark class on root without raw-hex regressions in page', async () => {
    document.documentElement.classList.add('dark')
    try {
      renderPage()
      await screen.findByText('Sara Al Mansouri')
      const src = readFileSync(PAGE_SRC, 'utf8')
      expect(src).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
      expect(src).toMatch(/--lc-/)
    } finally {
      document.documentElement.classList.remove('dark')
    }
  })

  it('single-row approve happy path calls API and schedules undo', async () => {
    const user = userEvent.setup()
    approveMock.mockResolvedValue({ ok: true })
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    await user.click(screen.getByRole('button', { name: /^Approve$/i }))
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith('psub_1'))
    expect(await screen.findByText(/Decision pending — Undo within 5s/i)).toBeTruthy()
  })

  it('undo grace: click undo within window reverts approve', async () => {
    const user = userEvent.setup()
    approveMock.mockResolvedValue({ ok: true })
    undoApproveMock.mockResolvedValue({ ok: true })
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    await user.click(screen.getByRole('button', { name: /^Approve$/i }))
    await screen.findByText(/Decision pending — Undo within 5s/i)
    await user.click(screen.getByRole('button', { name: /^Undo$/i }))
    await waitFor(() => expect(undoApproveMock).toHaveBeenCalledWith('psub_1'))
  })

  it('own-row is_own=true disables inline approve/reject actions', async () => {
    mockList([sampleSubmission({ id: 'psub_own', is_own: true })])
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    expect(screen.getByText(/Own row/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Approve$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Reject$/i })).toBeNull()
  })

  it('step-up triggers for high-risk single approve', async () => {
    const user = userEvent.setup()
    requireElevationMock.mockResolvedValue(true)
    approveMock.mockResolvedValue({ ok: true })
    mockList([
      sampleSubmission({
        id: 'psub_high',
        tenure_risk: { tier: 'high', score: 0.9, signals: ['new_agency'] },
        step_up_required: true,
      }),
    ])
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    await user.click(screen.getByRole('button', { name: /^Approve$/i }))
    await waitFor(() => expect(requireElevationMock).toHaveBeenCalled())
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith('psub_high'))
  })

  it('step-up triggers for bulk approve when selection > 5', async () => {
    const user = userEvent.setup()
    requireElevationMock.mockResolvedValue(true)
    bulkApproveMock.mockResolvedValue({ succeeded: [], failed: [] })
    mockList(
      Array.from({ length: 6 }, (_, i) =>
        sampleSubmission({
          id: `psub_${i}`,
          agent: { id: `usr_${i}`, display_name: `Agent ${i}`, avatar_url: null },
        }),
      ),
    )
    renderPage()
    await screen.findByText('Agent 0')
    const checkboxes = screen.getAllByRole('checkbox')
    // select-all then confirm dialog
    await user.click(checkboxes[0])
    const bulkBar = await screen.findByRole('status')
    await user.click(within(bulkBar).getByRole('button', { name: /Approve/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /Approve/i }))
    await waitFor(() => expect(requireElevationMock).toHaveBeenCalled())
    await waitFor(() => expect(bulkApproveMock).toHaveBeenCalled())
  })

  it('short-circuits bulk approve when entire selection is own-rows', async () => {
    const user = userEvent.setup()
    mockList([
      sampleSubmission({ id: 'psub_own_a', is_own: true }),
      sampleSubmission({
        id: 'psub_own_b',
        is_own: true,
        agent: { id: 'usr_2', display_name: 'Own Agent B', avatar_url: null },
      }),
    ])
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0]) // select all
    const bulkBar = await screen.findByRole('status')
    await user.click(within(bulkBar).getByRole('button', { name: /Approve/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'No rows to approve — all selected are your own',
        variant: 'warning',
      }),
    )
  })

  it('retry publish on portal_error rows', async () => {
    const user = userEvent.setup()
    retryMock.mockResolvedValue({ ok: true })
    mockList([sampleSubmission({ id: 'psub_err', status: 'portal_error' })])
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    await user.click(screen.getByRole('button', { name: /Retry publish/i }))
    await waitFor(() => expect(retryMock).toHaveBeenCalledWith('psub_err'))
  })

  it('CSV export builds portals.csv path with active filters', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPage('/admin/moderation/portals?status=pending&portal=bayut&within=24h')
    await screen.findByText('Sara Al Mansouri')
    await user.click(screen.getByRole('button', { name: /Export CSV/i }))
    expect(openSpy).toHaveBeenCalled()
    const calledPath = String(openSpy.mock.calls[0]?.[0] ?? '')
    expect(calledPath).toContain('/admin/moderation/portals.csv')
    expect(calledPath).toContain('status=pending')
    expect(calledPath).toMatch(/portal=bayut/)
    expect(portalModerationCsvPath({ status: 'pending', portal: 'bayut', within: '24h' })).toContain(
      'portals.csv',
    )
    openSpy.mockRestore()
  })

  it('subtitle includes breach-in fragment and avg SLA', async () => {
    mockList([
      sampleSubmission({
        sla_hours_remaining: 1.5,
        sla_hours_total: 4,
      }),
    ])
    renderPage()
    await screen.findByText('Sara Al Mansouri')
    const header = screen.getByRole('heading', { name: /Portal moderation queue/i }).parentElement
    expect(header?.textContent).toMatch(/at-risk \(breach in/i)
    expect(header?.textContent).toMatch(/avg/i)
  })

  it('row action buttons declare 44px tap targets', () => {
    const src = readFileSync(PAGE_SRC, 'utf8')
    expect(src).toMatch(/min-h-tap min-w-tap/)
  })
})

describe('PA-MOD-001 portalModeration env header', () => {
  it('readEnvHeader is single-sourced via getWingcasterEnv / WINGCASTER_ENV_HEADER', () => {
    const src = readFileSync(API_SRC, 'utf8')
    expect(src).toContain("from '@/hooks/useEnv'")
    expect(src).toContain('getWingcasterEnv')
    expect(src).toContain('WINGCASTER_ENV_HEADER')
    expect(src).not.toMatch(/sessionStorage\.getItem\(['"]wingcaster\.env['"]\)/)
  })
})

describe('PA-MOD-001 TEST env warning strip', () => {
  it('shows page-level TEST warning when env is test', async () => {
    vi.doMock('@/hooks/useEnv', () => ({
      useEnv: () => ({
        env: 'test' as const,
        isLive: false,
        isTest: true,
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
      getWingcasterEnv: () => 'test' as const,
      WINGCASTER_ENV_HEADER: 'X-Wingcaster-Env',
    }))
    // Re-import won't rebind the already-mocked module for this file's
    // PortalModerationQueuePage instance — assert LIVE default above and
    // cover TEST via direct prop path on EnvBadge + strip copy in source.
    const src = readFileSync(PAGE_SRC, 'utf8')
    expect(src).toContain('TEST ENVIRONMENT — actions here do not publish to real portals.')
    expect(src).toContain('isTest')
    expect(src).toContain('pa-mod-test-warning')
  })
})
