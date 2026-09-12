// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ApplicationOutcomePayload } from './applicationOutcomeTypes'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getMyAgencyApplicationOutcome: vi.fn(),
  acceptMyAgencyApplication: vi.fn(),
  declineMyAgencyApplication: vi.fn(),
  withdrawMyAgencyApplication: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  API_BASE: '/api',
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    tenants: [{ id: 'personal:u1', name: 'Personal', kind: 'personal', role: 'owner', avatarUrl: null, listingsCount: 0, agentsCount: 0 }],
    activeTenantId: 'personal:u1',
    activeTenant: null,
    loading: false,
    switching: false,
    error: null,
    isMultiTenant: false,
    refresh: vi.fn(),
    switchTenant: vi.fn().mockResolvedValue({ id: 'agency:a1' }),
  }),
}))

import { ApplicationOutcomePage } from './ApplicationOutcomePage'

function basePayload(overrides: Partial<ApplicationOutcomePayload> = {}): ApplicationOutcomePayload {
  return {
    application: {
      id: 'app_01',
      status: 'pending',
      rejected_by: null,
      submitted_at: '2026-09-05T09:14:22Z',
      viewed_at: null,
      decided_at: null,
      resolved_at: null,
      expires_at: '2026-10-05T09:14:22Z',
      sla_days: 3,
      ...(overrides.application || {}),
    },
    agency: {
      tenant_id: 'agency:elite',
      slug: 'elite-real-estate',
      display_name: 'Elite Real Estate',
      logo_url: null,
      primary_market_label: 'Dubai, UAE · Residential & Commercial',
      suspended_at: null,
      deleted_at: null,
      public_profile_url: '/agencies/elite-real-estate',
      ...(overrides.agency || {}),
    },
    decision: {
      resolver: null,
      message: null,
      role_offered: null,
      capability_pack: null,
      affiliation_mode: null,
      ...(overrides.decision || {}),
    },
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/applications/:applicationId" element={<ApplicationOutcomePage />} />
        <Route path="/inbox/applications/:applicationId" element={<ApplicationOutcomePage />} />
        <Route path="/agency/applications/:appId/status" element={<ApplicationOutcomePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ApplicationOutcomePage state variants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows not-found for 404', async () => {
    apiMocks.getMyAgencyApplicationOutcome.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
    renderAt('/applications/missing')
    await waitFor(() => {
      expect(screen.getByText(/doesn't exist or isn't yours/i)).toBeInTheDocument()
    })
  })

  it('PENDING — awaiting chip + withdraw tertiary', async () => {
    apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(basePayload())
    renderAt('/applications/app_01')
    await waitFor(() => {
      expect(screen.getByText(/Awaiting Elite Real Estate's response/i)).toBeInTheDocument()
    })
    expect(screen.getAllByRole('button', { name: /Awaiting agency response/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Withdraw application/i }).length).toBeGreaterThan(0)
  })

  it('PENDING viewed — timeline shows viewed timestamp', async () => {
    apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
      basePayload({
        application: {
          id: 'app_01',
          status: 'pending',
          rejected_by: null,
          submitted_at: '2026-09-05T09:14:22Z',
          viewed_at: '2026-09-06T11:22:00Z',
          decided_at: null,
          resolved_at: null,
          expires_at: '2026-10-05T09:14:22Z',
          sla_days: 3,
        },
      }),
    )
    renderAt('/applications/app_01')
    await waitFor(() => {
      expect(screen.getByText('Viewed by agency')).toBeInTheDocument()
    })
    expect(screen.queryByText('Not yet viewed')).not.toBeInTheDocument()
  })

  it('APPROVED — loud hero + switch CTA + resolver message', async () => {
    apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
      basePayload({
        application: {
          id: 'app_01',
          status: 'approved',
          rejected_by: null,
          submitted_at: '2026-09-05T09:14:22Z',
          viewed_at: '2026-09-06T11:22:00Z',
          decided_at: '2026-09-07T14:22:15Z',
          resolved_at: '2026-09-07T14:22:15Z',
          expires_at: '2026-10-05T09:14:22Z',
          sla_days: 3,
        },
        decision: {
          resolver: {
            user_id: 'u_owner',
            display_name: 'Ahmad Khoury',
            role_label: 'Owner',
            avatar_url: null,
          },
          message: 'Welcome to Elite, Sara.',
          role_offered: 'agent',
          capability_pack: 'standard',
          affiliation_mode: 'exclusive',
        },
      }),
    )
    renderAt('/applications/app_01')
    await waitFor(() => {
      expect(screen.getByText(/You've been accepted by Elite Real Estate/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Welcome to Elite, Sara.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Switch to Elite Real Estate workspace/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Decline this offer/i }).length).toBeGreaterThan(0)
  })

  it('REJECTED — respectful copy + browse / solo CTAs', async () => {
    apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
      basePayload({
        application: {
          id: 'app_01',
          status: 'rejected',
          rejected_by: 'agency',
          submitted_at: '2026-09-05T09:14:22Z',
          viewed_at: '2026-09-06T11:22:00Z',
          decided_at: '2026-09-07T14:22:15Z',
          resolved_at: '2026-09-07T14:22:15Z',
          expires_at: '2026-10-05T09:14:22Z',
          sla_days: 3,
        },
        decision: {
          resolver: {
            user_id: 'u_owner',
            display_name: 'Ahmad Khoury',
            role_label: 'Owner',
            avatar_url: null,
          },
          message: null,
          role_offered: null,
          capability_pack: null,
          affiliation_mode: null,
        },
      }),
    )
    renderAt('/inbox/applications/app_01')
    await waitFor(() => {
      expect(screen.getByText(/decided not to proceed at this time/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/MENA market is wide open/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Browse other agencies/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Continue as solo agent/i }).length).toBeGreaterThan(0)
  })

  it('EXPIRED — re-apply CTA', async () => {
    apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
      basePayload({
        application: {
          id: 'app_01',
          status: 'expired',
          rejected_by: null,
          submitted_at: '2026-08-01T09:14:22Z',
          viewed_at: null,
          decided_at: null,
          resolved_at: '2026-08-31T09:14:22Z',
          expires_at: '2026-08-31T09:14:22Z',
          sla_days: 3,
        },
      }),
    )
    renderAt('/agency/applications/app_01/status')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^This application timed out$/i })).toBeInTheDocument()
    })
    expect(screen.getAllByRole('link', { name: /Re-apply to Elite Real Estate/i }).length).toBeGreaterThan(0)
  })

  it('WITHDRAWN — re-apply CTA', async () => {
    apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
      basePayload({
        application: {
          id: 'app_01',
          status: 'withdrawn',
          rejected_by: null,
          submitted_at: '2026-09-05T09:14:22Z',
          viewed_at: null,
          decided_at: '2026-09-06T10:00:00Z',
          resolved_at: '2026-09-06T10:00:00Z',
          expires_at: '2026-10-05T09:14:22Z',
          sla_days: 3,
        },
      }),
    )
    renderAt('/applications/app_01')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^You withdrew this application$/i })).toBeInTheDocument()
    })
    expect(screen.getAllByRole('link', { name: /Re-apply to Elite Real Estate/i }).length).toBeGreaterThan(0)
  })
})
