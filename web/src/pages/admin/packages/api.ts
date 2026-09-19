/**
 * PA-PKG family API helpers (colocated wrappers over `@/api/client`).
 * All routes live under `/admin/fin/packages*` (real backend admin routes in
 * `backend/src/lib/packages/admin-routes.js`). Reads use `finGet`; writes use
 * `finPost` / `finPatch` (which attach If-Match + Idempotency-Key headers).
 */
import { api } from '@/api/client'
import type {
  MeteredFeature,
  PackageDetailResponse,
  PackageListResponse,
  PackageRow,
  PackageVersionDetail,
  PendingApprovalsResponse,
} from './types'

export interface PackageListQuery {
  active?: 'active' | 'all'
  tier?: string
}

function listParams(query: PackageListQuery = {}): string {
  const params = new URLSearchParams()
  if (query.active === 'active') params.set('active', 'true')
  if (query.tier) params.set('tier', query.tier)
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const packagesApi = {
  list: (query: PackageListQuery = {}): Promise<PackageListResponse> =>
    api.finGet(`/packages${listParams(query)}`) as unknown as Promise<PackageListResponse>,

  get: (packageId: string): Promise<PackageDetailResponse> =>
    api.finGet(`/packages/${encodeURIComponent(packageId)}`) as unknown as Promise<PackageDetailResponse>,

  getVersion: (packageId: string, versionId: string): Promise<PackageVersionDetail> =>
    api.finGet(
      `/packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}`,
    ) as unknown as Promise<PackageVersionDetail>,

  pendingApprovals: (): Promise<PendingApprovalsResponse> =>
    api.finGet('/packages/pending-approvals') as unknown as Promise<PendingApprovalsResponse>,

  createPackage: (body: {
    code: string
    display_name: string
    tier: string
    target_audience: string
    billing_cadence: string
  }): Promise<PackageRow> => api.finPost('/packages', body) as unknown as Promise<PackageRow>,

  createDraftVersion: (
    packageId: string,
    body: { copy_from_version_id?: string; properties_covered?: number; monthly_price_minor?: number } = {},
  ): Promise<PackageVersionDetail> =>
    api.finPost(
      `/packages/${encodeURIComponent(packageId)}/versions`,
      body,
    ) as unknown as Promise<PackageVersionDetail>,

  updateDraft: (
    packageId: string,
    versionId: string,
    body: { properties_covered?: number; monthly_price_minor?: number; effective_from?: string | null },
  ): Promise<PackageVersionDetail> =>
    api.finPatch(
      `/packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}`,
      body,
    ) as unknown as Promise<PackageVersionDetail>,

  submitForApproval: (packageId: string, versionId: string): Promise<Record<string, unknown>> =>
    api.finPost(
      `/packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}/submit-for-approval`,
    ),

  reject: (
    packageId: string,
    versionId: string,
    body: { reason: string },
  ): Promise<Record<string, unknown>> =>
    api.finPost(
      `/packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}/reject`,
      body,
    ),

  listFeatures: (query = ''): Promise<{ features: MeteredFeature[] }> =>
    api.finGet(`/metered-features${query}`) as unknown as Promise<{ features: MeteredFeature[] }>,

  getFeature: (featureId: string): Promise<MeteredFeature> =>
    api.finGet(`/metered-features/${encodeURIComponent(featureId)}`) as unknown as Promise<MeteredFeature>,

  patchFeature: (
    featureId: string,
    body: { display_name?: string; active?: boolean; reason: string },
  ): Promise<MeteredFeature> =>
    api.finPatch(
      `/metered-features/${encodeURIComponent(featureId)}`,
      body,
    ) as unknown as Promise<MeteredFeature>,
}
