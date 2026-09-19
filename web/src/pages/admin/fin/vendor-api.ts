/**
 * PA-VEN-003 — vendor admin API helpers.
 */
import { api } from '@/api/client'

export const vendorApi = {
  list: () => api.finGet('/vendors'),

  get: (vendorId: string) => api.finGet(`/vendors/${encodeURIComponent(vendorId)}`),

  applyRate: (vendorId: string, body: Record<string, unknown>) =>
    api.finPost(`/vendors/${encodeURIComponent(vendorId)}/rates`, body),
}
