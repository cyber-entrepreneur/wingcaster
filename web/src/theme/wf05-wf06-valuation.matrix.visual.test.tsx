// @vitest-environment jsdom
/**
 * Wave 5 WF-05/WF-06 — dark+RTL x mobile+desktop matrix (Chromatic stand-ins).
 * Covers PVA-009/009b, REC-003, APR-004/005 = 8 variants each.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import {
  assertNoPlaintextPiiInHtml,
  assertNoVisiblePlaintextPii,
  installMatchMediaFixture,
  mockComparableQueueList,
  mockPriceQueueList,
  sampleComparableQueueItem,
  sampleComparableDetail,
  samplePriceDetail,
  samplePriceQueueItem,
  samplePriceOutcomeIncorporated,
  samplePriceOutcomeSignalOnly,
  samplePriceTwoPersonDetail,
  type MatchMediaViewport,
} from '@/theme/wf05-wf06-fixtures'

const comparableApi = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  decide: vi.fn(),
  bulk: vi.fn(),
  affected: vi.fn(),
  audit: vi.fn(),
  history: vi.fn(),
}))
vi.mock('@/pages/admin/valuation/api', () => ({ comparableReportsApi: comparableApi }))

const clientApi = vi.hoisted(() => ({
  getAdminAgentPriceReports: vi.fn(),
  getAdminAgentPriceReport: vi.fn(),
  postAdminAgentPriceReportReview: vi.fn(),
  getAdminAgentPriceReportEvidenceUrl: vi.fn(),
  getMe: vi.fn(),
  getSubscription: vi.fn(),
}))
vi.mock('@/api/client', () => ({ API_BASE: '', getAuthToken: () => 't', api: clientApi }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'pa_1', name: 'PA One', role: 'platform_admin' },
    isAdmin: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))
vi.mock('@/context/EnvContext', () => ({ useEnv: () => ({ env: 'live', setEnv: vi.fn() }) }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const priceHook = vi.hoisted(() => ({
  report: null as ReturnType<typeof samplePriceOutcomeIncorporated> | null,
  loading: false,
  notFound: false,
  error: null as string | null,
  refetch: vi.fn(),
}))
vi.mock('@/pages/agent/reports/usePriceReportOutcome', () => ({
  usePriceReportOutcome: () => priceHook,
}))

import { BadComparableReportPage } from '@/pages/agent/reports/BadComparableReportPage'
import { PriceReportPage } from '@/pages/agent/reports/PriceReportPage'
import { PriceReportOutcomePage } from '@/pages/agent/reports/PriceReportOutcomePage'
import { PriceReportQueuePage } from '@/pages/admin/valuation/PriceReportQueuePage'
import { PriceReportDetailPage } from '@/pages/admin/valuation/PriceReportDetailPage'

type Mode = 'light' | 'dark'
type Dir = 'ltr' | 'rtl'

const VARIANTS: Array<[Mode, Dir, MatchMediaViewport]> = [
  ['light', 'ltr', 'desktop'],
  ['light', 'ltr', 'mobile'],
  ['light', 'rtl', 'desktop'],
  ['light', 'rtl', 'mobile'],
  ['dark', 'ltr', 'desktop'],
  ['dark', 'ltr', 'mobile'],
  ['dark', 'rtl', 'desktop'],
  ['dark', 'rtl', 'mobile'],
]

function applyTheme(mode: Mode, dir: Dir, viewport: MatchMediaViewport) {
  applyLcMode(mode)
  document.documentElement.dir = dir
  document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
  installMatchMediaFixture(viewport)
}

function serialize(root: HTMLElement): string {
  const mode = document.documentElement.getAttribute('data-lc-mode') || 'light'
  const dir = document.documentElement.dir || 'ltr'
  const lang = document.documentElement.lang || 'en'
  const vp = document.documentElement.getAttribute('data-viewport') || 'desktop'
  return `<!-- mode=${mode} dir=${dir} lang=${lang} viewport=${vp} -->\n${root.innerHTML}`
}

async function snap(label: string, root: HTMLElement) {
  const html = serialize(root)
  assertNoVisiblePlaintextPii(root, label)
  assertNoPlaintextPiiInHtml(html, label)
  expect(html).toMatchSnapshot()
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

beforeEach(() => {
  cleanup()
  applyTheme('light', 'ltr', 'desktop')
  comparableApi.list.mockResolvedValue(mockComparableQueueList([sampleComparableQueueItem()]))
  comparableApi.get.mockResolvedValue(sampleComparableDetail())
  comparableApi.affected.mockResolvedValue({ items: [] })
  comparableApi.audit.mockResolvedValue({ events: [] })
  comparableApi.history.mockResolvedValue({ items: [] })
  clientApi.getAdminAgentPriceReports.mockResolvedValue(mockPriceQueueList([samplePriceQueueItem()]))
  clientApi.getAdminAgentPriceReport.mockResolvedValue(samplePriceDetail())
  clientApi.getMe.mockResolvedValue({ id: 'pa_1' })
  clientApi.getSubscription.mockResolvedValue({ features: ['valuation.price_reports.submit'] })
  priceHook.report = samplePriceOutcomeIncorporated()
  priceHook.loading = false
  priceHook.notFound = false
  priceHook.error = null
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe.each(VARIANTS)('APR-004 submit %s %s %s', (mode, dir, viewport) => {
  it(`snapshot`, async () => {
    applyTheme(mode, dir, viewport)
    const view = render(
      <MemoryRouter initialEntries={['/reports/comparables/new?comparable_id=cmp_1&title=Apt%202405']}>
        <Routes>
          <Route path="/reports/comparables/new" element={<BadComparableReportPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Report a bad comparable/i })
    await snap(`APR-004 ${mode}-${dir}-${viewport}`, view.container)
  })
})

describe.each(VARIANTS)('APR-005 submit %s %s %s', (mode, dir, viewport) => {
  it(`snapshot`, async () => {
    applyTheme(mode, dir, viewport)
    const view = render(
      <MemoryRouter initialEntries={['/reports/prices/new']}>
        <Routes>
          <Route
            path="/reports/prices/new"
            element={<PriceReportPage featureFlagsOverride={{ 'valuation.price_reports.submit': true }} />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Submit a price report/i })
    await snap(`APR-005 ${mode}-${dir}-${viewport}`, view.container)
  })
})

describe.each(VARIANTS)('REC-003 incorporated %s %s %s', (mode, dir, viewport) => {
  it(`snapshot`, async () => {
    applyTheme(mode, dir, viewport)
    priceHook.report = samplePriceOutcomeIncorporated()
    const view = render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/reports/prices/apr_1/outcome']}>
          <Routes>
            <Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    )
    await screen.findByRole('heading', { name: /Your price signal is now live/i })
    await snap(`REC-003-incorporated ${mode}-${dir}-${viewport}`, view.container)
  })
})

describe.each(VARIANTS)('REC-003 signal-only %s %s %s', (mode, dir, viewport) => {
  it(`snapshot`, async () => {
    applyTheme(mode, dir, viewport)
    priceHook.report = samplePriceOutcomeSignalOnly()
    const view = render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/reports/prices/apr_2/outcome']}>
          <Routes>
            <Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    )
    await screen.findByRole('heading', { name: /accepted as one of several inputs/i })
    await snap(`REC-003-signal ${mode}-${dir}-${viewport}`, view.container)
  })
})

describe.each(VARIANTS)('PVA-009 queue %s %s %s', (mode, dir, viewport) => {
  it(`snapshot`, async () => {
    applyTheme(mode, dir, viewport)
    const view = render(
      <MemoryRouter initialEntries={['/admin/valuation/price-reports?status=pending_review']}>
        <Routes>
          <Route path="/admin/valuation/price-reports" element={<PriceReportQueuePage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findAllByText(/Dubai Marina/i)
    await snap(`PVA-009 ${mode}-${dir}-${viewport}`, view.container)
  })
})

describe.each(VARIANTS)('PVA-009b detail %s %s %s', (mode, dir, viewport) => {
  it(`snapshot`, async () => {
    applyTheme(mode, dir, viewport)
    clientApi.getAdminAgentPriceReport.mockResolvedValue(samplePriceTwoPersonDetail())
    const view = render(
      <MemoryRouter initialEntries={['/admin/valuation/price-reports/aprt_1']}>
        <Routes>
          <Route path="/admin/valuation/price-reports/:reportId" element={<PriceReportDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findAllByText(/Dubai Marina/i)
    await snap(`PVA-009b ${mode}-${dir}-${viewport}`, view.container)
  })
})
