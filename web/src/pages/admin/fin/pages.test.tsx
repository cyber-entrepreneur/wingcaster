// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  ApprovalAuditTrailPage, ApprovalsPage, AuditPage, ConfigurationPage, ContractsPage, CreditsPage,
  ExceptionsPage, FacilitiesPage, HoldsPage, InvoicesPage, OverviewPage,
  PackageApprovalPage, PackageDetailPage, PackagesPage, PackageVersionEditor,
  PricingPage, ReconciliationPage, SubscriptionDetailPage, SubscriptionsPage,
  TenantsPage, UsagePage, VendorCostsPage,
} from './index'

const apiMock = vi.hoisted(() => ({
  finGet: vi.fn(async (path = '') => {
    if (String(path).includes('metered-features')) {
      return { features: [{ id: 'f1', code: 'publishing.social.instagram', display_name: 'Instagram', category: 'publishing.social', meter_unit: 'post' }] }
    }
    if (String(path).includes('/versions/')) {
      return {
        id: 'v1', state: 'DRAFT', package_display_name: 'Starter', version_number: 1,
        quotas: [], flags: [], properties_covered: 1, monthly_price_minor: 100,
        tier: 'starter', target_audience: 'agent',
      }
    }
    if (String(path).includes('/packages/')) {
      return { id: 'p1', display_name: 'Starter', code: 'starter', tier: 'starter', target_audience: 'agent', versions: [] }
    }
    if (String(path).includes('/subscriptions/')) {
      return { id: 's1', status: 'ACTIVE', package_display_name: 'Starter', version_number: 1, properties_committed: 1, active_properties_count: 0 }
    }
    if (String(path).includes('/approvals')) {
      return {
        approvals: [{
          id: 'apr-1',
          action_kind: 'VENDOR_RATE_CHANGE',
          status: 'PENDING',
          created_at: '2026-08-01T00:00:00Z',
        }],
      }
    }
    return {
      tiles: {}, keys: [], tenants: [], rows: [], lots: [], holds: [],
      facilities: [], contracts: [], invoices: [], runs: [], types: [],
      approvals: [], events: [], vendors: [], stage11: false,
      dunning_policies: [], simulator: { amount_minor: '0' },
      reports: [], attestation: { eligible_to_sign: false },
      packages: [], subscriptions: [], features: [],
    }
  }),
  finPost: vi.fn(async () => ({ id: 'new' })),
  finPatch: vi.fn(async () => ({})),
  finDelete: vi.fn(async () => ({})),
  getApprovalAuditTrail: vi.fn(async () => ({
    request: {
      id: 'apr-1',
      action_kind: 'VENDOR_RATE_CHANGE',
      status: 'PENDING',
      payload_hash: 'abc123def456',
      workflow_code: 'WF-20',
    },
    events: [{
      id: 'evt-1',
      type: 'SUBMITTED',
      status: 'info',
      occurred_at: '2026-08-01T00:00:00Z',
      actor: { type: 'USER', id: 'admin-1', email: 'admin@example.com' },
      reason_code: null,
      target_type: 'approval_request',
      target_id: 'apr-1',
      before_state: null,
      after_state: null,
      payload_snapshot: { rate_key: 'gpt-4' },
      integrity_hash: 'abc123def456',
    }],
  })),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

const authMock = vi.hoisted(() => ({
  isAdmin: true,
  agent: { id: 'admin-1', platform_role: 'platform_admin' as const },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

function wrap(ui: ReactElement, initialPath = '/') {
  return render(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>)
}

describe('admin/fin pages', () => {
  beforeEach(() => {
    cleanup()
    authMock.isAdmin = true
    apiMock.finGet.mockClear()
    apiMock.finPost.mockClear()
  })

  const pages: Array<[string, () => ReactElement]> = [
    ['Overview', () => <OverviewPage />],
    ['Tenants', () => <TenantsPage />],
    ['Usage drill', () => <UsagePage />],
    ['Credit lots', () => <CreditsPage />],
    ['Holds', () => <HoldsPage />],
    ['Facilities', () => <FacilitiesPage />],
    ['Contracts', () => <ContractsPage />],
    ['Pricing simulator', () => <PricingPage />],
    ['Packages', () => <PackagesPage />],
    ['Package', () => <PackageDetailPage />],
    ['Package version', () => <PackageVersionEditor />],
    ['Package approvals', () => <PackageApprovalPage />],
    ['Subscriptions', () => <SubscriptionsPage />],
    ['Subscription', () => <SubscriptionDetailPage />],
    ['Invoices', () => <InvoicesPage />],
    ['Vendor costs', () => <VendorCostsPage />],
    ['Reconciliation', () => <ReconciliationPage />],
    ['Exceptions', () => <ExceptionsPage />],
    ['Approvals', () => <ApprovalsPage />],
    ['Approval audit trail', () => (
      <Routes>
        <Route path="/admin/fin/approvals/:id/audit" element={<ApprovalAuditTrailPage />} />
      </Routes>
    )],
    ['Audit', () => <AuditPage />],
    ['Configuration', () => <ConfigurationPage />],
  ]

  it.each(pages)('%s renders for a platform admin', (title, Page) => {
    const initialPath = title === 'Approval audit trail'
      ? '/admin/fin/approvals/apr-1/audit'
      : '/'
    const { container } = wrap(<Page />, initialPath)
    expect(container.querySelector('h1')?.textContent).toBe(title)
  })

  it('Overview is gated for non-admins', () => {
    authMock.isAdmin = false
    wrap(<OverviewPage />)
    expect(screen.getByText('Platform admin required')).toBeTruthy()
  })

  it('Approvals page exposes view audit CTA', async () => {
    wrap(<ApprovalsPage />)
    expect(await screen.findByRole('link', { name: 'View audit' })).toBeTruthy()
  })

  it('Approval audit trail page renders timeline panel', async () => {
    wrap(
      <Routes>
        <Route path="/admin/fin/approvals/:id/audit" element={<ApprovalAuditTrailPage />} />
      </Routes>,
      '/admin/fin/approvals/apr-1/audit',
    )
    expect(await screen.findByText('Immutable submission, decision, execution, and payload history.')).toBeTruthy()
    expect(await screen.findByText('Submitted')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeTruthy()
  })

  it('Vendor costs shows Stage 11 empty state', async () => {
    wrap(<VendorCostsPage />)
    expect(await screen.findByText(/Stage 11 not merged/)).toBeTruthy()
  })

  it('Packages page exposes create CTA', () => {
    wrap(<PackagesPage />)
    expect(screen.getByRole('button', { name: 'Create package' })).toBeTruthy()
  })

  it('Package version editor exposes save and submit CTAs', () => {
    wrap(<PackageVersionEditor />)
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeTruthy()
  })

  it('Package detail exposes compose CTA', () => {
    wrap(<PackageDetailPage />)
    expect(screen.getByRole('button', { name: 'Compose new version' })).toBeTruthy()
  })

  it('Subscription detail exposes pause and change-plan CTAs', () => {
    wrap(<SubscriptionDetailPage />)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change plan' })).toBeTruthy()
  })
})
