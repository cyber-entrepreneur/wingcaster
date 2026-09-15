// @vitest-environment jsdom
/**
 * Wave 5 WF-05/WF-06 — dark+RTL x mobile+desktop matrix (Chromatic stand-ins).
 * Covers PVA-009/009b, REC-003, APR-004/005 = 8 variants each.
 *
 * Dark ≠ light: stamp resolved `--lc-*` values as `data-lc-tokens` (Wave 4A
 * #118 visualSerialize). jsdom class strings stay `var(--lc-*)`; html attrs
 * alone are theatrical if the token stamp is missing.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { applyLcMode } from '@/theme/mode'
import { stampLcTokens, serializeVisualRoot } from '@/theme/visualSerialize'
import { ToastProvider } from '@/components/ui/toast'
import {
  FIXED_NOW,
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
/**
 * Keep English copy (stable heading queries) but mirror <html dir> into isArabic/dir
 * so submit pages set dir="rtl" without useLocale overwriting documentElement.
 */
vi.mock('@/hooks/useLocale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useLocale')>()
  return {
    ...actual,
    useLocale: () => {
      const dir = (document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr') as 'rtl' | 'ltr'
      return {
        locale: 'en' as const,
        setLocale: vi.fn(async () => ({ ok: true as const })),
        dir,
        isArabic: dir === 'rtl',
      }
    },
  }
})

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

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

/** Broadcast --lc-bg-page tokens (mode-flipping). Parsed from design system + known hex. */
const LIGHT_BG_PAGE_FROM_CSS = THEME_CSS.match(/:root \{[\s\S]*?--lc-bg-page:\s*(#[0-9A-Fa-f]{3,8})/)?.[1]
const DARK_BG_PAGE_FROM_CSS = THEME_CSS.match(
  /\[data-lc-mode="dark"\] \{[\s\S]*?--lc-bg-page:\s*(#[0-9A-Fa-f]{3,8})/,
)?.[1]
const LIGHT_BG_PAGE_ALLOWED = Array.from(
  new Set([LIGHT_BG_PAGE_FROM_CSS, '#FAF8F7', '#faf8f7'].filter(Boolean) as string[]),
)
const DARK_BG_PAGE_ALLOWED = Array.from(
  new Set([DARK_BG_PAGE_FROM_CSS, '#0C1533', '#0c1533'].filter(Boolean) as string[]),
)

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

/** Last applyTheme() variant — re-checked in snap() so useLocale cannot silently reset dir. */
let appliedVariant: { mode: Mode; dir: Dir; viewport: MatchMediaViewport } | null = null

/** Fail loud if mode/dir/viewport signals were not actually applied. */
function assertThemeSignalsApplied(mode: Mode, dir: Dir, viewport: MatchMediaViewport) {
  expect(document.documentElement.getAttribute('data-lc-mode')).toBe(mode)
  expect(document.documentElement.getAttribute('dir') ?? document.documentElement.dir).toBe(dir)
  expect(document.documentElement.getAttribute('lang') ?? document.documentElement.lang).toBe(
    dir === 'rtl' ? 'ar' : 'en',
  )
  expect(window.innerWidth).toBe(viewport === 'mobile' ? 375 : 1280)
  expect(document.documentElement.getAttribute('data-viewport')).toBe(viewport)

  const bgPage = getComputedStyle(document.documentElement).getPropertyValue('--lc-bg-page').trim()
  expect(bgPage).not.toBe('')
  const allowed = mode === 'dark' ? DARK_BG_PAGE_ALLOWED : LIGHT_BG_PAGE_ALLOWED
  expect(allowed.map((v) => v.toLowerCase())).toContain(bgPage.toLowerCase())
}

function applyTheme(mode: Mode, dir: Dir, viewport: MatchMediaViewport) {
  applyLcMode(mode)
  document.documentElement.dir = dir
  document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
  installMatchMediaFixture(viewport)
  assertThemeSignalsApplied(mode, dir, viewport)
  appliedVariant = { mode, dir, viewport }
}

function serialize(root: HTMLElement, mode: Mode): string {
  stampLcTokens(root, mode)
  root.setAttribute('data-viewport', appliedVariant?.viewport ?? 'desktop')
  const serialized = serializeVisualRoot(root, { mode })
  const tokens = JSON.parse(root.getAttribute('data-lc-tokens') || '{}') as Record<string, string>
  const bg = (tokens['--lc-bg-page'] || '').toLowerCase()
  const allowed = mode === 'dark' ? DARK_BG_PAGE_ALLOWED : LIGHT_BG_PAGE_ALLOWED
  expect(allowed.map((v) => v.toLowerCase())).toContain(bg)
  return serialized
}

async function snap(label: string, root: HTMLElement) {
  // Re-assert after render: catches useLocale (or anything else) resetting html signals.
  if (appliedVariant) {
    assertThemeSignalsApplied(appliedVariant.mode, appliedVariant.dir, appliedVariant.viewport)
  }
  const html = serialize(root, appliedVariant?.mode ?? 'light')
  assertNoVisiblePlaintextPii(root, label)
  assertNoPlaintextPiiInHtml(html, label)
  expect(html).toMatchSnapshot()
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  if (!document.getElementById('broadcast-theme-css')) {
    const style = document.createElement('style')
    style.id = 'broadcast-theme-css'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }
  expect(LIGHT_BG_PAGE_ALLOWED.length).toBeGreaterThan(0)
  expect(DARK_BG_PAGE_ALLOWED.length).toBeGreaterThan(0)
  expect(LIGHT_BG_PAGE_ALLOWED[0]!.toLowerCase()).not.toBe(DARK_BG_PAGE_ALLOWED[0]!.toLowerCase())
})

beforeEach(() => {
  cleanup()
  // Freeze wall clock so FIXED_NOW-relative fixture timestamps (and absolute
  // outcome dates) render stable relative strings — without this, PVA-009b
  // "Signed off Nd ago" flips as calendar days elapse past the #131 snap date.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(FIXED_NOW)
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
  vi.useRealTimers()
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

describe('theatrical-mode guard — data-lc-tokens dark ≠ light', () => {
  it('APR-004 dark stamp contains dark page hex, not the light palette', async () => {
    applyTheme('light', 'ltr', 'desktop')
    const lightView = render(
      <MemoryRouter initialEntries={['/reports/comparables/new?comparable_id=cmp_1&title=Apt%202405']}>
        <Routes>
          <Route path="/reports/comparables/new" element={<BadComparableReportPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Report a bad comparable/i })
    const lightSnap = serialize(lightView.container, 'light')
    cleanup()

    applyTheme('dark', 'ltr', 'desktop')
    const darkView = render(
      <MemoryRouter initialEntries={['/reports/comparables/new?comparable_id=cmp_1&title=Apt%202405']}>
        <Routes>
          <Route path="/reports/comparables/new" element={<BadComparableReportPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Report a bad comparable/i })
    const darkSnap = serialize(darkView.container, 'dark')

    expect(lightSnap).not.toEqual(darkSnap)
    expect(lightSnap).toContain('#FAF8F7')
    expect(darkSnap).toContain('#0C1533')
    expect(darkSnap).toContain('"--lc-bg-page":"#0C1533"')
    expect(lightSnap).toContain('"--lc-bg-page":"#FAF8F7"')
    expect(darkSnap).not.toContain('"--lc-bg-page":"#FAF8F7"')
  })
})
