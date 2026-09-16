// @vitest-environment jsdom
/**
 * PA-PKG family RTL/Arabic tests — every screen mounts under Arabic locale and
 * renders real MENA Arabic copy (no pending markers). Also statically asserts
 * every copy key has a non-empty Arabic value.
 */
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { PACKAGES_COPY, packagesT } from './packagesCopy'
import { PackageListPage } from './PackageListPage'
import { PackageApprovalQueuePage } from './PackageApprovalQueuePage'
import { PackageVersionHistoryPage } from './PackageVersionHistoryPage'
import type { PackageDetailResponse, PackageListResponse, PendingApprovalsResponse } from './types'

const listResponse: PackageListResponse = {
  env: 'live',
  packages: [
    {
      id: 'pkg_small_team',
      code: 'small-team',
      display_name: 'Small Team',
      tier: 'small_team',
      target_audience: 'agency',
      currency: 'USD',
      billing_cadence: 'monthly',
      active: true,
      environment: 'LIVE',
      subscribers_count: 12,
      updated_at: '2026-09-08T04:12:00Z',
      active_version: {
        id: 'pkgv_small_team_v6',
        version_number: 6,
        state: 'PUBLISHED',
        properties_covered: 100,
        monthly_price_minor: 9900,
        effective_from: '2026-06-02T00:00:00Z',
        effective_to: null,
      },
    },
  ],
}

const pendingResponse: PendingApprovalsResponse = { env: 'live', approvals: [] }

const packageDetail: PackageDetailResponse = {
  ...listResponse.packages[0],
  versions: [
    {
      id: 'pkgv_small_team_v6',
      package_id: 'pkg_small_team',
      version_number: 6,
      state: 'PUBLISHED',
      properties_covered: 100,
      monthly_price_minor: 9900,
      effective_from: '2026-06-02T00:00:00Z',
      effective_to: null,
      approval_request_id: null,
      created_at: '2026-06-01T00:00:00Z',
      package_code: 'small-team',
      package_display_name: 'Small Team',
      tier: 'small_team',
      target_audience: 'agency',
      currency: 'USD',
      billing_cadence: 'monthly',
      package_active: true,
      package_environment: 'LIVE',
      quotas: [],
      flags: [],
      approval: null,
    },
  ],
}

const apiMock = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  getVersion: vi.fn(),
  pendingApprovals: vi.fn(),
  createPackage: vi.fn(),
  createDraftVersion: vi.fn(),
  updateDraft: vi.fn(),
  submitForApproval: vi.fn(),
  reject: vi.fn(),
  listFeatures: vi.fn(),
}))

vi.mock('./api', () => ({ packagesApi: apiMock }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true, agent: { id: 'admin-1' } }) }))
vi.mock('@/hooks/useEnv', () => ({ useEnv: () => ({ env: 'live' as const }) }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'ar' as const, isArabic: true, dir: 'rtl' as const }),
}))

function wrap(ui: ReactElement, initialEntries: string[], routePath?: string) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        {routePath ? (
          <Routes>
            <Route path={routePath} element={ui} />
          </Routes>
        ) : (
          ui
        )}
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  document.documentElement.dir = 'rtl'
  document.documentElement.lang = 'ar'
  apiMock.list.mockResolvedValue(listResponse)
  apiMock.get.mockResolvedValue(packageDetail)
  apiMock.pendingApprovals.mockResolvedValue(pendingResponse)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PA-PKG copy — Arabic completeness', () => {
  it('every key has a non-empty Arabic string and no pending markers', () => {
    const offenders: string[] = []
    for (const [key, value] of Object.entries(PACKAGES_COPY)) {
      const ar = value.ar
      if (!ar || !ar.trim()) offenders.push(`${key}: empty`)
      if (/TRANSLATION-PENDING|\bTODO\b|\bTBD\b|pending translation/i.test(ar)) {
        offenders.push(`${key}: pending marker`)
      }
      // Must contain at least one Arabic-script character.
      if (!/[\u0600-\u06FF]/.test(ar)) offenders.push(`${key}: no Arabic script`)
    }
    expect(offenders).toEqual([])
  })

  it('interpolates variables into Arabic templates', () => {
    expect(packagesT('appr.version.transition', 'ar', { version: 7, base: 6 })).toContain('7')
    expect(packagesT('appr.version.transition', 'ar', { version: 7, base: 6 })).toContain('6')
  })
})

describe('PA-PKG screens render under Arabic locale', () => {
  it('list renders Arabic title with RTL document dir', async () => {
    wrap(<PackageListPage />, ['/admin/packages'])
    expect(await screen.findByText('الباقات')).toBeTruthy()
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('approval queue renders Arabic title', async () => {
    wrap(<PackageApprovalQueuePage />, ['/admin/packages/approvals'])
    expect(await screen.findByText('موافقات الباقات')).toBeTruthy()
  })

  it('version history renders Arabic tabs', async () => {
    wrap(<PackageVersionHistoryPage />, ['/admin/packages/pkg_small_team/history'], '/admin/packages/:packageId/history')
    expect(await screen.findByRole('tab', { name: 'الكل' })).toBeTruthy()
  })
})
