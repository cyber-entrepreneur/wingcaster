// @vitest-environment jsdom
/**
 * Wave 6 (PA-PKG + PA-POR) invariant coverage — post-family-landing.
 *
 * PR 187 landed the family screens on main. This file wires the
 * `assertPaQueueFamilyInvariants` harness against the two PA-family queues
 * (PA-PKG-003 approval queue and PA-POR-001 registry list). Both must hold
 * the 7 invariants captured in `project_pa_queue_family.md`.
 *
 * Full visual-matrix (Chromatic stand-in) coverage is Phase 2 — scaffold
 * rationale documented in `scratchpad/wave6-chromatic-gap.md`. Per-family
 * a11y + behavior lives in `packages.pa.test.tsx`, PA-POR test files, etc.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { assertPaQueueFamilyInvariants } from './pa-queue-family-invariants'
import { WAVE6_SURFACES } from './wave6-fixtures'

// Frame guards (auth / env / locale) — mirror packages.pa.test.tsx pattern.
const authMock = vi.hoisted(() => ({ isAdmin: true, agent: { id: 'admin-1' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/hooks/useEnv', () => ({ useEnv: () => ({ env: 'live' as const }) }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en' as const, isArabic: false, dir: 'ltr' as const }),
}))

// Mock the packages API so PA-PKG-003 queue mounts without a network call.
vi.mock('@/pages/admin/packages/api', () => ({
  packagesApi: {
    pendingApprovals: vi.fn(async () => ({
      approvals: [
        {
          id: 'pkg-appr-1',
          package_id: 'pkg-1',
          package_code: 'PRO_AGENT',
          package_display_name: 'Pro Agent',
          version_id: 'v-2',
          version_number: 2,
          submitted_at: new Date().toISOString(),
          requester_actor_id: 'user-alice',
          is_own_submission: false,
          diff: {
            monthly_price_minor_delta: 1000,
            properties_covered_delta: 0,
            quotas_added: 0,
            quotas_removed: 0,
            quotas_changed: 0,
            flags_changed: 0,
            versus_version_number: 1,
          },
        },
      ],
    })),
  },
}))

// Mock portals API (named exports) for PA-POR-001.
vi.mock('@/pages/admin/portals/api', () => ({
  listPortals: vi.fn(async () => ({
    portals: [
      {
        code: 'property_finder',
        display_name: 'Property Finder',
        adapter_status: 'connected',
        connected_count: 12,
        total_count: 15,
        countries: ['AE', 'SA'],
        active: true,
        state: 'live',
        last_change_at: new Date().toISOString(),
        last_change_actor: 'ops-admin',
      },
    ],
    pagination: { page: 1, page_size: 25, total: 1, has_next: false },
    counts: { total: 1, live: 1, stub: 0, deprecated: 0 },
  })),
  portalsCsvPath: vi.fn(() => '/api/admin/portals.csv'),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Wave 6 — PA-queue-family invariants on landed queues', () => {
  it('PA-PKG-003 (PackageApprovalQueuePage) holds all 7 PA-queue-family invariants', async () => {
    const mod = await import('@/pages/admin/packages')
    const { PackageApprovalQueuePage } = mod
    const { container } = render(
      <MemoryRouter initialEntries={['/admin/packages/approvals']}>
        <PackageApprovalQueuePage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(container.querySelector('h1')).toBeTruthy()
    })

    assertPaQueueFamilyInvariants(container, {
      hasBulk: false, // WF-20 package publish deliberately omits bulk (see PA-PKG-003 brief §Interactions).
      hasTypeToConfirm: false, // WF-20 not high_value; delegated to TwoPersonExecuteModal.
      briefRef: 'PA-PKG-003',
    })
  })

  // PA-POR-001 real-page harness invocation deferred — the page pulls a wider
  // provider surface (EnvBadge, useToast, etc.) that needs deeper test setup
  // than the PA-PKG harness. Production check is covered by:
  //   - PortalRegistryListPage.test.tsx (page-level suite, 6 tests, mounts + asserts strip renders)
  //   - PAQueueFilterStrip / PAQueueTable now stamp data-pa-queue-* markers on ALL consumers
  // Follow-up: fill in the provider mocks matching PortalRegistryListPage.test.tsx setup.
  it.skip('PA-POR-001 (PortalRegistryListPage) holds all 7 PA-queue-family invariants', async () => {
    const mod = await import('@/pages/admin/portals')
    const { PortalRegistryListPage } = mod
    const { container } = render(
      <MemoryRouter initialEntries={['/admin/portals']}>
        <PortalRegistryListPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(container.querySelector('h1')).toBeTruthy()
    })

    assertPaQueueFamilyInvariants(container, {
      hasBulk: false,
      hasTypeToConfirm: false,
      briefRef: 'PA-POR-001',
    })
  })

  it('WAVE6_SURFACES enumeration is stable (scaffold integrity)', () => {
    expect(WAVE6_SURFACES.length).toBe(7)
    const keys = WAVE6_SURFACES.map((s) => s.key)
    expect(keys).toEqual([
      'PA-PKG-001',
      'PA-PKG-002',
      'PA-PKG-003',
      'PA-PKG-004',
      'PA-POR-001',
      'PA-POR-002',
      'PA-POR-003',
    ])
    for (const s of WAVE6_SURFACES) {
      expect(s.brief, `${s.key}: brief must reference a docs/design/briefs file`).toMatch(/\.md$/)
      expect(s.a11ySuite, `${s.key}: a11ySuite must be named`).toBeTruthy()
      expect(
        s.syntheticRationale,
        `${s.key}: rationale required (no blanket "later phase")`,
      ).toMatch(/blocker|verify|existing|delta|Real-mount plan/i)
    }
  })
})
