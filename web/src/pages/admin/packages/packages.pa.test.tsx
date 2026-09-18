// @vitest-environment jsdom
/**
 * PA-PKG family tests — real page mounts, behavior, and jest-axe a11y.
 * Date.now() is frozen so relative-time output is deterministic.
 */
import type { ReactElement } from 'react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ToastProvider } from '@/components/ui/toast'
import { PackageListPage } from './PackageListPage'
import { PackageEditPage } from './PackageEditPage'
import { PackageApprovalQueuePage } from './PackageApprovalQueuePage'
import { PackageApprovalDetailPage } from './PackageApprovalDetailPage'
import { PackageVersionHistoryPage } from './PackageVersionHistoryPage'
import { PackageVersionReadOnlyPage } from './PackageVersionReadOnlyPage'
import type { ApprovalAuditTrail } from '@/components/approval'
import type {
  PackageDetailResponse,
  PackageListResponse,
  PackageVersionDetail,
  PendingApprovalsResponse,
} from './types'

expect.extend(toHaveNoViolations)

const FIXED_NOW = Date.parse('2026-09-16T12:00:00Z')

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
    {
      id: 'pkg_growth',
      code: 'growth',
      display_name: 'Growth',
      tier: 'growth',
      target_audience: 'agency',
      currency: 'USD',
      billing_cadence: 'monthly',
      active: true,
      environment: 'LIVE',
      subscribers_count: 3,
      updated_at: '2026-05-20T04:12:00Z',
      active_version: {
        id: 'pkgv_growth_v2',
        version_number: 2,
        state: 'PUBLISHED',
        properties_covered: 500,
        monthly_price_minor: 24900,
        effective_from: '2026-05-20T00:00:00Z',
        effective_to: null,
      },
    },
  ],
}

const pendingResponse: PendingApprovalsResponse = {
  env: 'live',
  approvals: [
    {
      id: 'pkgv_small_team_v7',
      version_number: 7,
      state: 'PENDING_APPROVAL',
      package_id: 'pkg_small_team',
      package_display_name: 'Small Team',
      package_code: 'small-team',
      tier: 'small_team',
      package_environment: 'LIVE',
      properties_covered: 150,
      monthly_price_minor: 11900,
      approval_id: 'appr_123',
      approval_status: 'REQUESTED',
      requester_actor_id: 'usr_fatima',
      submitted_at: '2026-09-16T10:00:00Z',
      is_own_submission: false,
      diff: {
        properties_covered_delta: 50,
        monthly_price_minor_delta: 2000,
        quotas_added: 0,
        quotas_removed: 0,
        quotas_changed: 0,
        flags_changed: 0,
        versus_version_id: 'pkgv_small_team_v6',
        versus_version_number: 6,
      },
    },
    {
      id: 'pkgv_growth_v3',
      version_number: 3,
      state: 'PENDING_APPROVAL',
      package_id: 'pkg_growth',
      package_display_name: 'Growth',
      package_code: 'growth',
      tier: 'growth',
      package_environment: 'LIVE',
      properties_covered: 500,
      monthly_price_minor: 24900,
      approval_id: 'appr_999',
      approval_status: 'REQUESTED',
      requester_actor_id: 'admin-1',
      submitted_at: '2026-09-15T10:00:00Z',
      is_own_submission: true,
      diff: {
        properties_covered_delta: 0,
        monthly_price_minor_delta: 0,
        quotas_added: 2,
        quotas_removed: 0,
        quotas_changed: 1,
        flags_changed: 1,
        versus_version_id: 'pkgv_growth_v2',
        versus_version_number: 2,
      },
    },
  ],
}

const draftDetail: PackageVersionDetail = {
  id: 'pkgv_small_team_v7',
  package_id: 'pkg_small_team',
  version_number: 7,
  state: 'DRAFT',
  properties_covered: 100,
  monthly_price_minor: 9900,
  effective_from: null,
  effective_to: null,
  approval_request_id: null,
  created_at: '2026-09-16T09:00:00Z',
  package_code: 'small-team',
  package_display_name: 'Small Team',
  tier: 'small_team',
  target_audience: 'agency',
  currency: 'USD',
  billing_cadence: 'monthly',
  package_active: true,
  package_environment: 'LIVE',
  quotas: [
    {
      id: 'q1',
      feature_id: 'f1',
      feature_code: 'credits.property_month',
      display_name: 'Property credits',
      category: 'credits',
      meter_unit: 'credit',
      credits_per_property: 100,
    },
  ],
  flags: [{ id: 'fl1', feature_code: 'governance.audit_export', enabled: true }],
  approval: null,
}

const packageDetail: PackageDetailResponse = {
  ...listResponse.packages[0],
  versions: [
    { ...draftDetail },
    {
      ...draftDetail,
      id: 'pkgv_small_team_v6',
      version_number: 6,
      state: 'PUBLISHED',
      properties_covered: 100,
      monthly_price_minor: 9900,
      effective_from: '2026-06-02T00:00:00Z',
    },
    {
      ...draftDetail,
      id: 'pkgv_small_team_v5',
      version_number: 5,
      state: 'DEPRECATED',
      properties_covered: 75,
      monthly_price_minor: 8900,
      effective_from: '2026-04-14T00:00:00Z',
      effective_to: '2026-06-02T00:00:00Z',
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

const approvalApiMock = vi.hoisted(() => ({
  getApprovalAuditTrail: vi.fn(),
}))

vi.mock('./api', () => ({ packagesApi: apiMock }))
vi.mock('@/api/client', () => ({ api: approvalApiMock }))

const authMock = vi.hoisted(() => ({ isAdmin: true, agent: { id: 'admin-1' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/hooks/useEnv', () => ({ useEnv: () => ({ env: 'live' as const }) }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en' as const, isArabic: false, dir: 'ltr' as const }),
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
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
  apiMock.list.mockResolvedValue(listResponse)
  apiMock.get.mockResolvedValue(packageDetail)
  apiMock.getVersion.mockResolvedValue(draftDetail)
  apiMock.pendingApprovals.mockResolvedValue(pendingResponse)
  apiMock.createDraftVersion.mockResolvedValue(draftDetail)
  apiMock.updateDraft.mockResolvedValue(draftDetail)
  apiMock.submitForApproval.mockResolvedValue({})
  apiMock.reject.mockResolvedValue({})
  approvalApiMock.getApprovalAuditTrail.mockResolvedValue({
    request: {
      id: 'appr_123',
      tenant_id: null,
      action_kind: 'PACKAGE_PUBLISH',
      status: 'REQUESTED',
      workflow_code: 'WF-07',
      value_tier: 'elevated',
      min_distinct_approvers: 2,
      created_at: '2026-09-16T10:00:00Z',
      updated_at: '2026-09-16T10:00:00Z',
      payload_hash: 'abc123def456',
      payload: {},
    },
    events: [
      {
        id: 'evt-submitted',
        type: 'SUBMITTED',
        status: 'info',
        occurred_at: '2026-09-16T10:00:00Z',
        actor: { type: 'USER', id: 'usr_fatima', email: null },
        reason_code: null,
        target_type: 'approval_request',
        target_id: 'appr_123',
        before_state: null,
        after_state: null,
        payload_snapshot: { monthly_price_minor: 11900 },
        integrity_hash: 'abc123def456',
      },
    ],
  } satisfies ApprovalAuditTrail)
  authMock.isAdmin = true
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('PA-PKG-001 package list', () => {
  it('renders the catalog and status badges', async () => {
    wrap(<PackageListPage />, ['/admin/packages'])
    await screen.findByText('Small Team')
    expect(screen.getByText('Growth')).toBeTruthy()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /New package/i })).toBeTruthy()
  })

  it('shows an error banner with retry when the list fails', async () => {
    apiMock.list.mockRejectedValueOnce(new Error('boom'))
    wrap(<PackageListPage />, ['/admin/packages'])
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy()
  })

  it('gates non-admins', async () => {
    authMock.isAdmin = false
    wrap(<PackageListPage />, ['/admin/packages'])
    expect(await screen.findByText(/package-admin access/i)).toBeTruthy()
  })

  it('has no axe violations', async () => {
    const { container } = wrap(<PackageListPage />, ['/admin/packages'])
    await screen.findByText('Small Team')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('PA-PKG-002 package edit', () => {
  const routePath = '/admin/packages/:packageId/versions/:versionId/edit'
  const entry = ['/admin/packages/pkg_small_team/versions/pkgv_small_team_v7/edit']

  it('renders draft fields and no diff initially', async () => {
    wrap(<PackageEditPage />, entry, routePath)
    await screen.findByText(/Editing Small Team/i)
    expect(screen.getByLabelText(/Monthly price/i)).toBeTruthy()
    expect(screen.getByText(/No changes yet/i)).toBeTruthy()
  })

  it('surfaces the two-person banner when price changes', async () => {
    wrap(<PackageEditPage />, entry, routePath)
    await screen.findByText(/Editing Small Team/i)
    const price = screen.getByLabelText(/Monthly price/i)
    fireEvent.change(price, { target: { value: '11900' } })
    expect(document.querySelector('[data-two-person-banner]')).toBeTruthy()
    expect(document.querySelector('[data-diff-field="price"]')).toBeTruthy()
  })

  it('marks non-draft versions read-only', async () => {
    apiMock.getVersion.mockResolvedValueOnce({ ...draftDetail, state: 'PUBLISHED' })
    wrap(<PackageEditPage />, entry, routePath)
    await screen.findByText(/cannot be edited/i)
    expect((screen.getByLabelText(/Monthly price/i) as HTMLInputElement).disabled).toBe(true)
  })

  it('has no axe violations', async () => {
    const { container } = wrap(<PackageEditPage />, entry, routePath)
    await screen.findByText(/Editing Small Team/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('PA-PKG-003 approval queue', () => {
  it('excludes own submissions in the awaiting-my-review tab', async () => {
    wrap(<PackageApprovalQueuePage />, ['/admin/packages/approvals'])
    await screen.findByText('Small Team')
    expect(screen.queryByText('Growth')).toBeNull()
    // All-pending tab reveals the own submission.
    fireEvent.click(screen.getByRole('tab', { name: /All pending/i }))
    expect(await screen.findByText('Growth')).toBeTruthy()
  })

  it('renders a two-person badge for price/coverage changes', async () => {
    wrap(<PackageApprovalQueuePage />, ['/admin/packages/approvals'])
    await screen.findByText('Small Team')
    expect(screen.getByText('Two-person')).toBeTruthy()
  })

  it('has no axe violations', async () => {
    const { container } = wrap(<PackageApprovalQueuePage />, ['/admin/packages/approvals'])
    await screen.findByText('Small Team')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('PA-PKG-003 approval detail (WF-20 consumer)', () => {
  const routePath = '/admin/packages/approvals/:versionId'

  it('renders the diff and enables approve for a peer submission', async () => {
    wrap(<PackageApprovalDetailPage />, ['/admin/packages/approvals/pkgv_small_team_v7'], routePath)
    await screen.findByText(/Approve v7 of Small Team/i)
    expect(document.querySelector('[data-diff-field="price"]')).toBeTruthy()
    const approve = screen.getByRole('button', { name: /Approve and publish/i }) as HTMLButtonElement
    expect(approve.disabled).toBe(false)
    expect(await screen.findByText('Approval audit trail')).toBeTruthy()
    expect(screen.getByText('Submitted')).toBeTruthy()
  })

  it('blocks approve and offers recall for own submissions', async () => {
    wrap(<PackageApprovalDetailPage />, ['/admin/packages/approvals/pkgv_growth_v3'], routePath)
    await screen.findByText(/Approve v3 of Growth/i)
    const approve = screen.getByRole('button', { name: /Approve and publish/i }) as HTMLButtonElement
    expect(approve.disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Recall this submission/i })).toBeTruthy()
  })

  it('opens the reject dialog and requires a reason', async () => {
    wrap(<PackageApprovalDetailPage />, ['/admin/packages/approvals/pkgv_small_team_v7'], routePath)
    await screen.findByText(/Approve v7 of Small Team/i)
    fireEvent.click(screen.getByRole('button', { name: /Reject and return to draft/i }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: /Reject and return to draft/i }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText(/Reason for the submitter/i), {
      target: { value: 'Price is too aggressive for this tier.' },
    })
    expect(confirm.disabled).toBe(false)
  })

  it('shows a not-found notice when the version is no longer pending', async () => {
    wrap(<PackageApprovalDetailPage />, ['/admin/packages/approvals/does_not_exist'], routePath)
    expect(await screen.findByText(/no longer pending approval/i)).toBeTruthy()
  })

  it('has no axe violations', async () => {
    const { container } = wrap(
      <PackageApprovalDetailPage />,
      ['/admin/packages/approvals/pkgv_small_team_v7'],
      routePath,
    )
    await screen.findByText(/Approve v7 of Small Team/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('PA-PKG-004 version history', () => {
  const routePath = '/admin/packages/:packageId/history'

  it('renders a timeline card per version with filter tabs', async () => {
    wrap(<PackageVersionHistoryPage />, ['/admin/packages/pkg_small_team/history'], routePath)
    await screen.findByText(/version history/i)
    expect(document.querySelectorAll('[data-version-id]').length).toBe(3)
    fireEvent.click(screen.getByRole('tab', { name: /^Draft$/i }))
    expect(document.querySelectorAll('[data-version-id]').length).toBe(1)
  })

  it('has no axe violations', async () => {
    const { container } = wrap(
      <PackageVersionHistoryPage />,
      ['/admin/packages/pkg_small_team/history'],
      routePath,
    )
    await screen.findByText(/version history/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('PA-PKG-004 read-only version detail', () => {
  const routePath = '/admin/packages/:packageId/versions/:version'
  const entry = ['/admin/packages/pkg_small_team/versions/pkgv_small_team_v7']

  it('renders the version and a compare selector', async () => {
    apiMock.getVersion.mockResolvedValueOnce({ ...draftDetail, monthly_price_minor: 11900 })
    wrap(<PackageVersionReadOnlyPage />, entry, routePath)
    await screen.findByText(/Small Team — v7/i)
    expect(screen.getByLabelText(/Compare against/i)).toBeTruthy()
  })

  it('has no axe violations', async () => {
    const { container } = wrap(<PackageVersionReadOnlyPage />, entry, routePath)
    await screen.findByText(/Small Team — v7/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Token hygiene (packages module)', () => {
  it('contains no raw hex in source files', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const HEX = /#[0-9A-Fa-f]{3,8}\b/
    const offenders: string[] = []
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const full = path.join(d, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(tsx|ts)$/.test(name) && !name.includes('.test.')) {
          if (HEX.test(readFileSync(full, 'utf8'))) offenders.push(name)
        }
      }
    }
    walk(dir)
    expect(offenders).toEqual([])
  })
})
