// @vitest-environment jsdom
/**
 * Wave 5 WF-05/WF-06 — visual / DOM snapshot matrix (Chromatic stand-ins).
 *
 * CRITICAL PII-safety: every default-state snapshot must show MASKED
 * reporter identifiers only — zero plaintext "Ahmed Khan" / "Sara Al Mansouri".
 *
 * Chromatic / Storybook are not configured — see scratchpad/wave5-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import { StatusHero } from '@/components/recipient/StatusHero'
import { WeightingPanel } from '@/pages/agent/reports/WeightingPanel'
import {
  assertNoPlaintextPii,
  assertNoVisiblePlaintextPii,
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

type Mode = 'light' | 'dark'
type Dir = 'ltr' | 'rtl'

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
  document.body.querySelectorAll('[data-radix-portal]').forEach((n) => n.remove())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
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
  return `<!-- mode=${mode} dir=${dir} lang=${lang} -->\n${clone.innerHTML}\n<!-- portals -->\n${portals}`
}

function applyTheme(mode: Mode, dir: Dir) {
  applyLcMode(mode)
  document.documentElement.dir = dir
  document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
}

async function snap(label: string, root: HTMLElement) {
  const html = serialize(root)
  // Visible / non-sr-only tree must stay PII-safe. Full HTML may still contain
  // Phase A sr-only heading echoes of agent display_name (PVA-009b).
  assertNoVisiblePlaintextPii(root, label)
  // For non-PA-detail pages, also gate the full serialized HTML.
  if (!/PVA-009b/.test(label)) {
    assertNoPlaintextPii(html.replace(/<[^>]*class="[^"]*sr-only[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/g, ''), label)
  }
  expect(html).toMatchSnapshot()
}


/**
 * Chromatic stand-in checklist (~16 snaps):
 * 01–02 StatusHero loud vs default
 * 03–04 WeightingPanel incorporated / signal-only
 * 05 AGT-APR-004 submit
 * 06 AGT-APR-005 submit
 * 07–08 AGT-REC-002 removed (loud) + quarantined (default)
 * 09–10 AGT-REC-003 incorporated + signal-only
 * 11 PA-PVA-008 queue + bulk-select (no confirm-remove)
 * 12 PA-PVA-008 queue dark RTL
 * 13 PA-PVA-008b detail pending
 * 14 PA-PVA-008b high-impact two-person progress
 * 15 PA-PVA-009 queue
 * 16 PA-PVA-009b detail + two-person
 */
describe('Wave 5 WF-05/WF-06 visual matrix — Chromatic stand-ins (PII-safe)', () => {
  it('01 StatusHero-loud-approved-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = render(
      <ToastProvider>
        <StatusHero state="approved" label="We removed this comparable" emphasis="loud" />
      </ToastProvider>,
    )
    await snap('01 StatusHero loud', view.container)
  })

  it('02 StatusHero-default-approved-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = render(
      <ToastProvider>
        <StatusHero
          state="approved"
          label="We flagged this comparable for further verification"
          emphasis="default"
        />
      </ToastProvider>,
    )
    await snap('02 StatusHero default', view.container)
  })

  it('03 WeightingPanel-incorporated-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = render(
      <WeightingPanel
        weight={100}
        mode="incorporated"
        marketSegmentLabel="Dubai Marina · 2-3BR"
        effectiveOn="2026-09-05T00:00:00Z"
      />,
    )
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100')
    await snap('03 WeightingPanel incorporated', view.container)
  })

  it('04 WeightingPanel-signal-only-dark-rtl', async () => {
    applyTheme('dark', 'rtl')
    const view = render(
      <WeightingPanel weight={50} mode="signal_only" marketSegmentLabel="Downtown Dubai · 1BR" />,
    )
    expect(screen.getByTestId('weighting-panel')).toHaveAttribute('dir', 'ltr')
    await snap('04 WeightingPanel signal-only dark rtl', view.container)
  })

  it('05 AGT-APR-004-submit-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = render(
      <MemoryRouter initialEntries={['/reports/comparables/new?comparable_id=cmp_1&title=Apt%202405']}>
        <Routes>
          <Route path="/reports/comparables/new" element={<BadComparableReportPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Report a bad comparable/i })
    await snap('05 APR-004 submit', view.container)
  })

  it('06 AGT-APR-005-submit-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = render(
      <MemoryRouter initialEntries={['/reports/prices/new']}>
        <Routes>
          <Route
            path="/reports/prices/new"
            element={
              <PriceReportPage featureFlagsOverride={{ 'valuation.price_reports.submit': true }} />
            }
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Submit a price report/i })
    await snap('06 APR-005 submit', view.container)
  })

  it('07 AGT-REC-002-removed-loud-light-ltr', async () => {
    applyTheme('light', 'ltr')
    comparableHook.report = sampleComparableOutcomeRemoved()
    const view = render(
      <MemoryRouter initialEntries={['/reports/comparables/cmr_1/outcome']}>
        <Routes>
          <Route
            path="/reports/comparables/:reportId/outcome"
            element={<ComparableReportOutcomePage />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /We removed this comparable/i })
    await snap('07 REC-002 removed loud', view.container)
  })

  it('08 AGT-REC-002-quarantined-default-dark-rtl', async () => {
    applyTheme('dark', 'rtl')
    comparableHook.report = sampleComparableOutcomeQuarantined()
    const view = render(
      <MemoryRouter initialEntries={['/reports/comparables/cmr_2/outcome']}>
        <Routes>
          <Route
            path="/reports/comparables/:reportId/outcome"
            element={<ComparableReportOutcomePage />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', {
      name: /flagged this comparable for further verification/i,
    })
    await snap('08 REC-002 quarantined dark rtl', view.container)
  })

  it('09 AGT-REC-003-incorporated-light-ltr', async () => {
    applyTheme('light', 'ltr')
    priceHook.report = samplePriceOutcomeIncorporated()
    const view = render(
      <MemoryRouter initialEntries={['/reports/prices/apr_1/outcome']}>
        <Routes>
          <Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Your price signal is now live/i })
    await snap('09 REC-003 incorporated', view.container)
  })

  it('10 AGT-REC-003-signal-only-light-ltr', async () => {
    applyTheme('light', 'ltr')
    priceHook.report = samplePriceOutcomeSignalOnly()
    const view = render(
      <MemoryRouter initialEntries={['/reports/prices/apr_2/outcome']}>
        <Routes>
          <Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /accepted as one of several inputs/i })
    await snap('10 REC-003 signal-only', view.container)
  })

  it('11 PA-PVA-008-queue-bulk-select-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = render(
      <MemoryRouter initialEntries={['/admin/valuation/comparable-reports']}>
        <Routes>
          <Route path="/admin/valuation/comparable-reports" element={<BadComparableQueuePage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByText('Villa · Saadiyat')
    fireEvent.click(screen.getByLabelText(/Select row cmr_001/i))
    const bar = document.querySelector('[data-pa-queue-bulk-actions]') as HTMLElement
    expect(bar.getAttribute('data-pa-queue-bulk-actions')).toBe('reject,request_info')
    expect(screen.queryByText('Ahmed Khan')).toBeNull()
    await snap('11 PVA-008 queue bulk-select', view.container)
  })

  it('12 PA-PVA-008-queue-dark-rtl', async () => {
    applyTheme('dark', 'rtl')
    const view = render(
      <MemoryRouter initialEntries={['/admin/valuation/comparable-reports']}>
        <Routes>
          <Route path="/admin/valuation/comparable-reports" element={<BadComparableQueuePage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByText('Villa · Saadiyat')
    expect(screen.queryByText('Ahmed Khan')).toBeNull()
    await snap('12 PVA-008 queue dark rtl', view.container)
  })

  it('13 PA-PVA-008b-detail-pending-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = render(
      <MemoryRouter initialEntries={['/admin/valuation/comparable-reports/cmr_001']}>
        <Routes>
          <Route
            path="/admin/valuation/comparable-reports/:reportId"
            element={<BadComparableDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByText('Villa · Saadiyat')
    expect(screen.queryByText('Ahmed Khan')).toBeNull()
    await snap('13 PVA-008b detail pending', view.container)
  })

  it('14 PA-PVA-008b-two-person-progress-light-ltr', async () => {
    applyTheme('light', 'ltr')
    comparableApi.get.mockResolvedValue(sampleComparableTwoPersonDetail())
    const view = render(
      <MemoryRouter initialEntries={['/admin/valuation/comparable-reports/cmr_001']}>
        <Routes>
          <Route
            path="/admin/valuation/comparable-reports/:reportId"
            element={<BadComparableDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('progressbar', { name: /Two-person approval progress/i })
    expect(screen.queryByText('Ahmed Khan')).toBeNull()
    await snap('14 PVA-008b two-person progress', view.container)
  })

  it('15 PA-PVA-009-queue-light-ltr', async () => {
    applyTheme('light', 'ltr')
    const view = render(
      <MemoryRouter initialEntries={['/admin/valuation/price-reports?status=pending_review']}>
        <Routes>
          <Route path="/admin/valuation/price-reports" element={<PriceReportQueuePage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findAllByText(/Dubai Marina/i)
    expect(document.querySelector('[data-pii-kind="name"][data-pii-revealed="false"]')).toBeTruthy()
    await snap('15 PVA-009 queue', view.container)
  })

  it('16 PA-PVA-009b-detail-two-person-light-ltr', async () => {
    applyTheme('light', 'ltr')
    clientApi.getAdminAgentPriceReport.mockResolvedValue(samplePriceTwoPersonDetail())
    const view = render(
      <MemoryRouter initialEntries={['/admin/valuation/price-reports/aprt_1']}>
        <Routes>
          <Route
            path="/admin/valuation/price-reports/:reportId"
            element={<PriceReportDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('progressbar', { name: /Two-person approval progress/i })
    expect(document.querySelector('[data-pii-kind="name"][data-pii-revealed="false"]')).toBeTruthy()
    await snap('16 PVA-009b detail two-person', view.container)
  })
})
