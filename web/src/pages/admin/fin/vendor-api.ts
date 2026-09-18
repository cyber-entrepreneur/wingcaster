/**
 * PA-VEN-003 / PA-VEN-004 — vendor admin API helpers.
 */
import { api } from '@/api/client'

export const vendorApi = {
  list: () => api.finGet('/vendors'),

  get: (vendorId: string) => api.finGet(`/vendors/${encodeURIComponent(vendorId)}`),

  applyRate: (vendorId: string, body: Record<string, unknown>) =>
    api.finPost(`/vendors/${encodeURIComponent(vendorId)}/rates`, body),

  listStatements: (vendorId: string) =>
    api.finGet(`/vendors/${encodeURIComponent(vendorId)}/statements`),

  getStatement: (vendorId: string, month: string) =>
    api.finGet(`/vendors/${encodeURIComponent(vendorId)}/statements/${encodeURIComponent(month)}`),

  reconcileStatement: (vendorId: string, month: string, body: Record<string, unknown> = {}) =>
    api.finPost(
      `/vendors/${encodeURIComponent(vendorId)}/statements/${encodeURIComponent(month)}/reconcile`,
      body,
    ),
}
