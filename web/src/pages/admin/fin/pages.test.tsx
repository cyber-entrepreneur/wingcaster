// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  ApprovalsPage, AuditPage, ConfigurationPage, ContractDetailPage, ContractsPage,
  ContractVersionEditorPage, CreditsPage,
  ExceptionDetailPage, ExceptionsPage, FacilitiesPage, HoldsPage, InvoicesPage, OverviewPage,
  PackageApprovalPage, PackageDetailPage, PackagesPage, PackageVersionEditor,
  PriceDetailPage, PricingPage as FinPricingPage, ReconciliationPage, SubscriptionDetailPage,
  SubscriptionsPage, TenantsPage, UsagePage, VendorCostsPage,
} from './index'

const apiMock = vi.hoisted(() => ({
  finGet: vi.fn(async (path = '') => {
    if (String(path).includes('metered-features')) {
      return { features: [{ id: 'f1', code: 'publishing.social.instagram', display_name: 'Instagram', category: 'publishing.social', meter_unit: 'post' }] }
    }
    if (String(path).includes('/tenants/') && !String(path).includes('?')) {
      return {
        id: 't1', public_tenant_id: 'tenant-a', billing_account_id: 'ba-1', holder_id: 'h1',
      }
    }
    if (String(path).includes('/versions/')) {
      return {
        id: 'v1', state: 'DRAFT', package_display_name: 'Starter', version_number: 1,
        quotas: [], flags: [], properties_covered: 1, monthly_price_minor: 100,
        tier: 'starter', target_audience: 'agent',
      }
    }
    if (String(path).includes('/packages/')) {
      return {
        id: 'p1', display_name: 'Starter', code: 'starter', tier: 'starter', target_audience: 'agent',
        subscribers_count: 2,
        versions: [{
          id: 'v-pub', version_number: 2, state: 'PUBLISHED', properties_covered: 10,
          monthly_price_minor: 1000, subscribers_count: 1, effective_from: '2026-01-01T00:00:00.000Z',
        }],
      }
    }
    if (String(path).includes('/prices/active-catalog')) {
      return { prices: [{ id: 'p1', code: 'social.post', currency: 'USD', unit_rate_minor: 100 }] }
    }
    if (String(path) === '/contracts') {
      return { contracts: [{ id: 'c1', contract_number: 'C-1001', status: 'ACTIVE', billing_currency: 'USD', version: 1 }] }
    }
    if (String(path).includes('/contracts/')) {
      return {
        id: 'c1', contract_number: 'C-1001', status: 'ACTIVE', billing_currency: 'USD',
        tenant_public_id: 'tenant-1', version: 1, component_count: 0,
        active_version: { id: 'v1', version_n: 1, status: 'ACTIVE', components: [] },
        versions: [{ id: 'v1', version_n: 1, status: 'ACTIVE', components: [] }],
      }
    }
    if (String(path).includes('/subscriptions/')) {
      return { id: 's1', status: 'ACTIVE', package_display_name: 'Starter', version_number: 1, properties_committed: 1, active_properties_count: 0 }
    }
    if (String(path).match(/\/prices\/.+/)) {
      return {
        id: 'pr1',
        code: 'feature.social.post',
        currency: 'USD',
        version: 2,
        versions: [
          {
            id: 'pv1', version_n: 1, model: 'PER_UNIT', unit_rate_minor: 100,
            status: 'ACTIVE', effective_from: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'pv2', version_n: 2, model: 'PER_UNIT', unit_rate_minor: 120,
            status: 'DRAFT', effective_from: '2026-02-01T00:00:00.000Z',
          },
        ],
      }
    }
    if (String(path) === '/prices') {
      return { prices: [{ id: 'pr1', code: 'feature.social.post', currency: 'USD', version: 2 }] }
    }
    if (String(path).includes('/exceptions/items')) {
      return {
        items: [{
          id: 'USAGE_DLQ:00000000-0000-0000-0000-000000000001',
          exception_type: 'USAGE_DLQ',
          severity: 'HIGH',
          status: 'OPEN',
          tenant_id: 'tenant-1',
          description: 'DLQ test row',
          created_at: '2026-01-01T00:00:00.000Z',
        }],
      }
    }
    if (String(path).match(/\/exceptions\/.+/)) {
      return {
        id: 'USAGE_DLQ:00000000-0000-0000-0000-000000000001',
        exception_type: 'USAGE_DLQ',
        severity: 'HIGH',
        status: 'OPEN',
        tenant_id: 'tenant-1',
        description: 'DLQ test row',
        payload: { error_code: 'TEST' },
        related_drifts: [],
        notes: [],
        deferred: true,
        dl: 'DL-165',
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
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

const authMock = vi.hoisted(() => ({
  isAdmin: true,
  agent: { id: 'admin-1', platform_role: 'platform_admin' as const },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

function wrap(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
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
    ['Contract detail', () => <ContractDetailPage />],
    ['Contract version editor', () => <ContractVersionEditorPage />],
    ['Pricing', () => <FinPricingPage />],
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
    ['Audit', () => <AuditPage />],
    ['Configuration', () => <ConfigurationPage />],
  ]

  it.each(pages)('%s renders for a platform admin', (title, Page) => {
    const { container } = wrap(<Page />)
    expect(container.querySelector('h1')?.textContent).toBe(title)
  })

  it('Overview is gated for non-admins', () => {
    authMock.isAdmin = false
    wrap(<OverviewPage />)
    expect(screen.getByText('Platform admin required')).toBeTruthy()
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

  it('Package detail exposes compose and deprecate CTAs', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/fin/packages/p1']}>
        <Routes>
          <Route path="/admin/fin/packages/:id" element={<PackageDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: 'Compose new version' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Deprecate v2' })).toBeTruthy()
  })

  it('Facilities page exposes create CTA', () => {
    wrap(<FacilitiesPage />)
    expect(screen.getByRole('button', { name: 'Create facility' })).toBeTruthy()
  })

  it('Subscription detail exposes pause and change-plan CTAs', () => {
    wrap(<SubscriptionDetailPage />)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change plan' })).toBeTruthy()
  })

  it('Exception detail renders for a platform admin', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/fin/exceptions/USAGE_DLQ%3A00000000-0000-0000-0000-000000000001']}>
        <Routes>
          <Route path="/admin/fin/exceptions/:id" element={<ExceptionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Exception detail' })).toBeTruthy()
  })

  it('Exception detail exposes resolve and wont-fix actions', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/fin/exceptions/USAGE_DLQ%3A00000000-0000-0000-0000-000000000001']}>
        <Routes>
          <Route path="/admin/fin/exceptions/:id" element={<ExceptionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: 'Resolve' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mark wont-fix' })).toBeTruthy()
  })
  it('Price detail exposes version lifecycle actions', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/fin/pricing/pr1']}>
        <Routes>
          <Route path="/admin/fin/pricing/:id" element={<PriceDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Price detail' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New version' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Activate v/ })).toBeTruthy()
  })

  it('Reconciliation exposes manual run CTA', () => {
    wrap(<ReconciliationPage />)
    expect(screen.getByRole('button', { name: 'Run reconciliation' })).toBeTruthy()
  })
  it('Pricing page exposes new version CTA', () => {
    wrap(<FinPricingPage />)
    expect(screen.getByRole('button', { name: 'New version' })).toBeTruthy()
  })
})
