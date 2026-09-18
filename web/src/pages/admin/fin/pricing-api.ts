/**
 * PA-PRC-002 — versioned fin price admin writes (If-Match OCC).
 */
import { api } from '@/api/client'

async function finPostVersioned(
  path: string,
  body: Record<string, unknown>,
  version: number | string,
) {
  return api.finPost(path, body, { ifMatch: version })
}

export const pricingApi = {
  get: (priceId: string) => api.finGet(`/prices/${encodeURIComponent(priceId)}`),

  list: () => api.finGet('/prices'),

  draftVersion: (
    priceId: string,
    body: Record<string, unknown>,
    version: number | string,
  ) => finPostVersioned(`/prices/${encodeURIComponent(priceId)}/versions`, body, version),

  activateVersion: (
    priceId: string,
    versionId: string,
    body: Record<string, unknown>,
    priceVersion: number | string,
  ) => finPostVersioned(
    `/prices/${encodeURIComponent(priceId)}/versions/${encodeURIComponent(versionId)}/activate`,
    body,
    priceVersion,
  ),

  deprecateVersion: (
    priceId: string,
    versionId: string,
    body: Record<string, unknown>,
    priceVersion: number | string,
  ) => finPostVersioned(
    `/prices/${encodeURIComponent(priceId)}/versions/${encodeURIComponent(versionId)}/deprecate`,
    body,
    priceVersion,
  ),
}
