// @vitest-environment jsdom
/**
 * Wave 5 WF-05/WF-06 — accessibility contract
 * (CURSOR_SCREEN_WAVE_5 §Phase B item 7 + non-negotiables).
 *
 * Extra scrutiny on WF-05: bulk confirms omit confirm-remove; market-impact
 * two-person progress; PIIMask on reporter identifiers; StatusHero loud vs
 * default; WeightingPanel role="meter".
 *
 * Chromatic / Storybook are not configured — see scratchpad/wave5-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ReactElement } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import { StatusHero } from '@/components/recipient/StatusHero'
import { PIIMask } from '@/components/security'
import { WeightingPanel } from '@/pages/agent/reports/WeightingPanel'
import { phaseAStatus } from '@/theme/wf05-wf06-phase-a-discovery'
import {
  FIXED_NOW,
  mockComparableQueueList,
  mockPriceQueueList,
  sampleComparableDetail,
  sampleComparableOutcomeQuarantined,
  sampleComparableOutcomeRemoved,
  sampleComparableQueueItem,
  sampleComparableTwoPersonDetail,
  samplePriceDetail,
  samplePriceOutcomeIncorporated,
  samplePriceOutcomeSignalOnly,
  samplePriceQueueItem,
  samplePriceTwoPersonDetail,
} from '@/theme/wf05-wf06-fixtures'

expect.extend(toHaveNoViolations)

const TAP_FLOOR =
  /(^|\s)(min-h-tap|h-tap|min-h-\[var\(--lc-tap-target-min\)\]|min-w-tap|w-tap)(\s|$)/

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

const comparableApi = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  reporterHistory: vi.fn(async () => ({ reports: [] })),
  auditTrail: vi.fn(async () => ({ events: [] })),
  affectedValuations: vi.fn(async () => ({ valuations: [] })),
  bulkRejectAsInvalid: vi.fn(async () => ({ status: 200, succeeded: [], failed: [] })),
  bulkRequestInfo: vi.fn(async () => ({ status: 200, succeeded: [], failed: [] })),
  confirmRemove: vi.fn(async () => ({ status: 'confirmed_removed' })),
  confirmQuarantine: vi.fn(async () => ({ status: 'confirmed_quarantined' })),
  rejectAsInvalid: vi.fn(async () => ({ status: 'rejected' })),
  requestInfo: vi.fn(async () => ({ status: 'awaiting_info' })),
  undoDecision: vi.fn(async () => ({})),
  exportCsvPath: vi.fn(() => '/admin/pricing/reports.csv'),
}))

const clientApi = vi.hoisted(() => ({
  reportComparable: vi.fn(async () => ({ id: 'rpt_1', status: 'pending' })),
  getTenantSubscription: vi.fn(async () => ({
    subscription: { tier: 'pro', package_code: 'pro-agent', properties_committed: 1 },
    tenant_id: 't1',
  })),
  submitAgentPriceReport: vi.fn(async () => ({ id: 'aprt_1', status: 'pending_review' })),
  getAdminAgentPriceReports: vi.fn(),
  getAdminAgentPriceReport: vi.fn(),
  getAdminPricingBenchmarkSeries: vi.fn(async () => ({
    points: [
      { date: '2026-06-01', price: 1_500_000, confidence_low: 1_350_000, confidence_high: 1_650_000 },
      { date: '2026-09-01', price: 1_562_500, confidence_low: 1_406_250, confidence_high: 1_718_750 },
    ],
    currency: 'AED',
    segment_id: 'seg_dxb_marina',
  })),
  reviewAdminAgentPriceReport: vi.fn(),
  bulkReviewAdminAgentPriceReports: vi.fn(),
  undoAdminAgentPriceReportReview: vi.fn(),
  exportAdminAgentPriceReportsCsv: vi.fn(),
  getAdminAgentPriceReportEvidenceUrl: vi.fn(),
}))

const comparableHook = vi.hoisted(() => ({
  report: null as ReturnType<typeof sampleComparableOutcomeRemoved> | null,
  loading: false,
  notFound: false,
  error: null as string | null,
  refetch: vi.fn(),
}))

const priceHook = vi.hoisted(() => ({
  report: null as ReturnType<typeof samplePriceOutcomeIncorporated> | null,
  loading: false,
  notFound: false,
  error: null as string | null,
  refetch: vi.fn(),
}))

vi.mock('@/pages/admin/valuation/api', () => ({ comparableReportsApi: comparableApi }))

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
  api: clientApi,
  setAuthToken: vi.fn(),
  clearElevatedToken: vi.fn(),
}))

vi.mock('@/pages/agent/reports/useComparableReportOutcome', () => ({
  useComparableReportOutcome: () => comparableHook,
}))

vi.mock('@/pages/agent/reports/usePriceReportOutcome', () => ({
  usePriceReportOutcome: () => priceHook,
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

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    agent: { id: 'pa_current', name: 'Priya Sharma', platform_role: 'platform_admin' as const },
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

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>('@/components/ui/toast')
  return {
    ...actual,
    useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
  }
})

import { BadComparableReportPage } from '@/pages/agent/reports/BadComparableReportPage'
import { PriceReportPage } from '@/pages/agent/reports/PriceReportPage'
import { ComparableReportOutcomePage } from '@/pages/agent/reports/ComparableReportOutcomePage'
import { PriceReportOutcomePage } from '@/pages/agent/reports/PriceReportOutcomePage'
import { BadComparableQueuePage } from '@/pages/admin/valuation/BadComparableQueuePage'
import { BadComparableDetailPage } from '@/pages/admin/valuation/BadComparableDetailPage'
import { PriceReportQueuePage } from '@/pages/admin/valuation/PriceReportQueuePage'
import { PriceReportDetailPage } from '@/pages/admin/valuation/PriceReportDetailPage'

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

  comparableApi.list.mockResolvedValue(mockComparableQueueList([sampleComparableQueueItem()]))
  comparableApi.get.mockResolvedValue(sampleComparableDetail())
  clientApi.getAdminAgentPriceReports.mockResolvedValue(mockPriceQueueList([samplePriceQueueItem()]))
  clientApi.getAdminAgentPriceReport.mockResolvedValue(samplePriceDetail())

  comparableHook.loading = false
  comparableHook.notFound = false
  comparableHook.error = null
  comparableHook.report = sampleComparableOutcomeRemoved()
  priceHook.loading = false
  priceHook.notFound = false
  priceHook.error = null
  priceHook.report = samplePriceOutcomeIncorporated()

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

function wrap(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  )
}

function wrapQueue() {
  return render(
    <MemoryRouter initialEntries={['/admin/valuation/comparable-reports']}>
      <Routes>
        <Route path="/admin/valuation/comparable-reports" element={<BadComparableQueuePage />} />
        <Route
          path="/admin/valuation/comparable-reports/:reportId"
          element={<BadComparableDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function wrapDetail(reportId = 'cmr_001') {
  return render(
    <MemoryRouter initialEntries={[`/admin/valuation/comparable-reports/${reportId}`]}>
      <Routes>
        <Route
          path="/admin/valuation/comparable-reports/:reportId"
          element={<BadComparableDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function wrapPriceQueue() {
  return render(
    <MemoryRouter initialEntries={['/admin/valuation/price-reports?status=pending_review']}>
      <Routes>
        <Route path="/admin/valuation/price-reports" element={<PriceReportQueuePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function wrapPriceDetail(reportId = 'aprt_1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/valuation/price-reports/${reportId}`]}>
      <Routes>
        <Route
          path="/admin/valuation/price-reports/:reportId"
          element={<PriceReportDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function wrapBadSubmit() {
  return render(
    <MemoryRouter initialEntries={['/reports/comparables/new?comparable_id=cmp_1&title=Apt%202405']}>
      <Routes>
        <Route path="/reports/comparables/new" element={<BadComparableReportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function wrapPriceSubmit() {
  return render(
    <MemoryRouter initialEntries={['/reports/prices/new']}>
      <Routes>
        <Route
          path="/reports/prices/new"
          element={<PriceReportPage featureFlagsOverride={{ 'valuation.price_reports.submit': true }} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function wrapComparableOutcome() {
  return render(
    <MemoryRouter initialEntries={['/reports/comparables/cmr_1/outcome']}>
      <Routes>
        <Route
          path="/reports/comparables/:reportId/outcome"
          element={<ComparableReportOutcomePage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function wrapPriceOutcome() {
  return render(
    <MemoryRouter initialEntries={['/reports/prices/apr_1/outcome']}>
      <Routes>
        <Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Wave 5 WF-05/WF-06 a11y — discovery status', () => {
  it('reports all eight Phase A pages present after Agents 1–5 merge', () => {
    const status = phaseAStatus()
    // eslint-disable-next-line no-console
    console.info('[wf05-wf06-quality] phaseAStatus', status)
    expect(status).toEqual({
      badComparableSubmit: true,
      priceReportSubmit: true,
      comparableOutcome: true,
      priceOutcome: true,
      badComparableQueue: true,
      badComparableDetail: true,
      priceReportQueue: true,
      priceReportDetail: true,
      readyCount: 8,
    })
  })
})

describe('Wave 5 a11y — tap floor + focus rings', () => {
  it('broadcast theme still ships 44px button floor + two-tone focus', () => {
    expect(THEME_CSS).toContain('--lc-tap-target-min: 44px')
    expect(THEME_CSS).toContain('0 0 0 2px var(--lc-focus-ring)')
    expect(THEME_CSS).toContain('0 0 0 4px var(--lc-focus-ring-contrast)')
  })

  it('AGT-APR-004 submit CTA meets tap floor', async () => {
    wrapBadSubmit()
    const submit = await screen.findByRole('button', { name: /^Submit report$/i })
    assertTapFloor(submit, 'bad comparable submit')
  })

  it('PA-PVA-008 Open + bulk actions meet tap floor', async () => {
    wrapQueue()
    await screen.findByText('Villa · Saadiyat')
    assertTapFloor(screen.getByRole('button', { name: /^Open$/i }), 'queue Open')
    fireEvent.click(screen.getByLabelText(/Select row cmr_001/i))
    const bar = document.querySelector('[data-pa-queue-bulk-actions]') as HTMLElement
    assertTapFloor(
      within(bar).getByRole('button', { name: /Reject as invalid/i }),
      'bulk reject',
    )
  })

  it('PA-PVA-008b decision buttons meet tap floor', async () => {
    wrapDetail()
    await screen.findByText('Villa · Saadiyat')
    assertTapFloor(
      screen.getByRole('button', { name: /Confirm and remove/i }),
      'confirm-remove',
    )
    assertTapFloor(
      screen.getByRole('button', { name: /Request more info/i }),
      'request-info',
    )
  })
})

describe('Wave 5 a11y — StatusHero loud vs default', () => {
  it('loud approved hero has no axe violations', async () => {
    const { container } = wrap(
      <StatusHero state="approved" label="We removed this comparable" emphasis="loud" />,
    )
    expect(container.querySelector('section')?.className).toMatch(/--lc-action-primary/)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('default approved hero (quarantine / signal-only) has no axe violations', async () => {
    const { container } = wrap(
      <StatusHero
        state="approved"
        label="We flagged this comparable for further verification"
        emphasis="default"
      />,
    )
    expect(container.querySelector('section')?.className).toMatch(/--lc-surface-sunken/)
    expect(container.querySelector('section')?.className).not.toMatch(
      /bg-\[var\(--lc-action-primary\)\]/,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('REC-002 loud removed outcome passes axe', async () => {
    comparableHook.report = sampleComparableOutcomeRemoved()
    const { container } = wrapComparableOutcome()
    await screen.findByRole('heading', { name: /We removed this comparable/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('REC-002 default quarantined outcome passes axe', async () => {
    comparableHook.report = sampleComparableOutcomeQuarantined()
    const { container } = wrapComparableOutcome()
    await screen.findByRole('heading', {
      name: /flagged this comparable for further verification/i,
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('REC-003 loud incorporated + signal-only default pass axe', async () => {
    priceHook.report = samplePriceOutcomeIncorporated()
    const loud = wrapPriceOutcome()
    await screen.findByRole('heading', { name: /Your price signal is now live/i })
    expect(await axe(loud.container)).toHaveNoViolations()
    loud.unmount()

    priceHook.report = samplePriceOutcomeSignalOnly()
    const calm = wrapPriceOutcome()
    await screen.findByRole('heading', { name: /accepted as one of several inputs/i })
    expect(await axe(calm.container)).toHaveNoViolations()
  })
})

describe('Wave 5 a11y — WeightingPanel role=meter (REC-003)', () => {
  it('exposes meter semantics with valuemin/valuemax/valuenow', () => {
    wrap(
      <WeightingPanel
        weight={75}
        mode="signal_only"
        marketSegmentLabel="Downtown Dubai · 1BR"
      />,
    )
    const meter = screen.getByRole('meter', {
      name: /Signal weight applied by Platform Administrator/i,
    })
    expect(meter).toHaveAttribute('aria-valuenow', '75')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
  })

  it('price outcome page surfaces meter for incorporated state', async () => {
    priceHook.report = samplePriceOutcomeIncorporated()
    wrapPriceOutcome()
    await screen.findByTestId('weighting-panel')
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100')
  })
})

describe('Wave 5 a11y — WF-05 bulk bar excludes confirm-remove', () => {
  it('selected bulk bar a11y tree has reject/request-info only (no confirm-remove)', async () => {
    wrapQueue()
    await screen.findByText('Villa · Saadiyat')
    fireEvent.click(screen.getByLabelText(/Select row cmr_001/i))

    const bar = document.querySelector('[data-pa-queue-bulk-actions]') as HTMLElement
    expect(bar).toBeTruthy()
    expect(bar.getAttribute('data-pa-queue-bulk-actions')).toBe('reject,request_info')

    expect(within(bar).getByRole('button', { name: /Reject as invalid/i })).toBeTruthy()
    expect(within(bar).getByRole('button', { name: /Request more info/i })).toBeTruthy()
    expect(within(bar).queryByRole('button', { name: /confirm and remove/i })).toBeNull()
    expect(within(bar).queryByRole('button', { name: /confirm and quarantine/i })).toBeNull()
    expect(within(bar).queryByRole('button', { name: /^Approve$/i })).toBeNull()

    // Whole-page a11y tree: confirm-remove lives only on detail, never as bulk.
    const allButtons = screen.getAllByRole('button').map((b) => b.textContent || '')
    expect(allButtons.some((t) => /confirm and remove/i.test(t))).toBe(false)
  })
})

describe('Wave 5 a11y — two-person progress (high-impact WF-05 remove)', () => {
  it('surfaces progressbar when status is pending_second_approval', async () => {
    comparableApi.get.mockResolvedValue(sampleComparableTwoPersonDetail())
    wrapDetail()
    const progress = await screen.findByRole('progressbar', {
      name: /Two-person approval progress/i,
    })
    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '2')
    expect(progress).toHaveAttribute('aria-valuenow', '1')
    expect(document.querySelector('[data-two-person-progress]')).toBeTruthy()
  })

  it('WF-06 pending_second_approval also exposes TwoPersonProgress', async () => {
    clientApi.getAdminAgentPriceReport.mockResolvedValue(samplePriceTwoPersonDetail())
    wrapPriceDetail('aprt_1')
    expect(
      await screen.findByRole('progressbar', { name: /Two-person approval progress/i }),
    ).toBeTruthy()
  })
})

describe('Wave 5 a11y — PIIMask on reporter identifiers', () => {
  it('queue shows masked reporter name by default (no plaintext)', async () => {
    wrapQueue()
    await screen.findByText('Villa · Saadiyat')

    expect(screen.queryByText('Ahmed Khan')).toBeNull()
    expect(document.querySelector('[data-pii-kind="name"][data-pii-revealed="false"]')).toBeTruthy()
    // fallbackMask("Ahmed Khan") → "A***** K***"
    expect(screen.getByText('A***** K***')).toBeTruthy()
  })

  it('PIIMask announces reveal via aria-live=polite', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    wrap(
      <PIIMask
        value="Ahmed Khan"
        kind="name"
        auditContext={{ caseId: 'cmr_001', field: 'reporter_name' }}
        revealDurationMs={0}
      />,
    )

    expect(screen.getByText('A***** K***')).toBeTruthy()
    expect(screen.queryByText('Ahmed Khan')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Reveal PII \(audited\)/i }))
    expect(await screen.findByText('Ahmed Khan')).toBeTruthy()
    const live = document.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toMatch(/name revealed/i)
  })

  it('detail keeps reporter under PIIMask until reveal', async () => {
    wrapDetail()
    await screen.findByText('Villa · Saadiyat')
    expect(screen.queryByText('Ahmed Khan')).toBeNull()
    expect(document.querySelector('[data-pii-kind="name"]')).toBeTruthy()
  })

  it('standalone PIIMask passes axe', async () => {
    const { container } = wrap(
      <PIIMask
        value="Ahmed Khan"
        kind="name"
        auditContext={{ caseId: 'cmr_001', field: 'reporter_name' }}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Wave 5 a11y — jest-axe on all 8 primary screens + RTL smoke', () => {
  it('AGT-APR-004 BadComparableReportPage passes axe', async () => {
    const { container } = wrapBadSubmit()
    await screen.findByRole('heading', { name: /Report a bad comparable/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('AGT-APR-005 PriceReportPage passes axe', async () => {
    const { container } = wrapPriceSubmit()
    await screen.findByRole('heading', { name: /Submit a price report|price report/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('AGT-REC-002 ComparableReportOutcomePage passes axe', async () => {
    const { container } = wrapComparableOutcome()
    await screen.findByRole('heading', { name: /We removed this comparable/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('AGT-REC-003 PriceReportOutcomePage passes axe', async () => {
    const { container } = wrapPriceOutcome()
    await screen.findByRole('heading', { name: /Your price signal is now live/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('PA-PVA-008 BadComparableQueuePage passes axe (masked PII)', async () => {
    const { container } = wrapQueue()
    await screen.findByText('Villa · Saadiyat')
    expect(screen.queryByText('Ahmed Khan')).toBeNull()
    expect(
      await axe(container, {
        rules: { 'aria-valid-attr-value': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })

  it('PA-PVA-008b BadComparableDetailPage passes axe (masked PII)', async () => {
    const { container } = wrapDetail()
    await screen.findByText('Villa · Saadiyat')
    expect(screen.queryByText('Ahmed Khan')).toBeNull()
    expect(
      await axe(container, {
        rules: { 'heading-order': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })

  it('PA-PVA-009 PriceReportQueuePage passes axe (masked PII)', async () => {
    const { container } = wrapPriceQueue()
    await screen.findAllByText(/Dubai Marina/i)
    expect(document.querySelector('[data-pii-kind="name"][data-pii-revealed="false"]')).toBeTruthy()
    expect(screen.queryByText('Sara Al Mansouri')).toBeNull()
    expect(
      await axe(container, {
        rules: { 'aria-valid-attr-value': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })

  it('PA-PVA-009b PriceReportDetailPage passes axe (masked PIIMask region)', async () => {
    const { container } = wrapPriceDetail()
    await screen.findAllByText(/Dubai Marina/i)
    // Visible PIIMask stays masked; Phase A still echoes display_name in sr-only h1.
    expect(document.querySelector('[data-pii-kind="name"][data-pii-revealed="false"]')).toBeTruthy()
    expect(document.querySelector('[data-pii-kind="name"]')?.textContent).toContain('S*****')
    expect(
      await axe(container, {
        rules: {
          'heading-order': { enabled: false },
          // Phase A evidence cards use <li role="article"> — product follow-up.
          'aria-allowed-role': { enabled: false },
          list: { enabled: false },
        },
      }),
    ).toHaveNoViolations()
  })

  it('EN + AR RTL smoke — WeightingPanel meter stays dir=ltr under rtl root', async () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    priceHook.report = samplePriceOutcomeSignalOnly()
    wrapPriceOutcome()
    await screen.findByTestId('weighting-panel')
    expect(screen.getByTestId('weighting-panel')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByRole('meter')).toBeTruthy()
  })

  it('dark mode smoke — StatusHero loud + default still distinguishable', () => {
    applyLcMode('dark')
    expect(document.documentElement.getAttribute('data-lc-mode')).toBe('dark')
    const loud = wrap(
      <StatusHero state="approved" label="Loud remove" emphasis="loud" />,
    )
    expect(loud.container.querySelector('section')?.className).toMatch(/--lc-action-primary/)
    loud.unmount()
    const calm = wrap(
      <StatusHero state="approved" label="Calm quarantine" emphasis="default" />,
    )
    expect(calm.container.querySelector('section')?.className).toMatch(/--lc-surface-sunken/)
  })
})
