import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'

export interface SavedView {
  id: string
  resource: string
  name: string
  owner_user_id: string
  shared_with_tenant: boolean
  filter: Record<string, unknown>
  sort: unknown[]
  column_prefs: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface UseSavedViewsResult {
  views: SavedView[]
  loading: boolean
  createView: (input: {
    name: string
    filter?: Record<string, unknown>
    sort?: unknown[]
    shared_with_tenant?: boolean
    column_prefs?: Record<string, unknown>
  }) => Promise<SavedView>
  renameView: (id: string, name: string) => Promise<void>
  shareView: (id: string, shared: boolean) => Promise<void>
  deleteView: (id: string) => Promise<void>
  reload: () => Promise<void>
}

const SEED_VIEWS: SavedView[] = [
  {
    id: 'seed-all',
    resource: 'listings',
    name: 'All',
    owner_user_id: 'system',
    shared_with_tenant: true,
    filter: {},
    sort: [],
    column_prefs: {},
  },
  {
    id: 'seed-drafts',
    resource: 'listings',
    name: 'My active drafts',
    owner_user_id: 'system',
    shared_with_tenant: true,
    filter: { status: ['draft'] },
    sort: [],
    column_prefs: {},
  },
  {
    id: 'seed-below-market',
    resource: 'listings',
    name: 'Below market price',
    owner_user_id: 'system',
    shared_with_tenant: true,
    filter: { below_market: true },
    sort: [],
    column_prefs: {},
  },
  {
    id: 'seed-expiring',
    resource: 'listings',
    name: 'Expiring soon',
    owner_user_id: 'system',
    shared_with_tenant: true,
    filter: { expiring_soon: true },
    sort: [],
    column_prefs: {},
  },
]

/** AGT-LST-002 — CRUD saved views for a tenant. */
export function useSavedViews(tenantId: string | null | undefined): UseSavedViewsResult {
  const [views, setViews] = useState<SavedView[]>(SEED_VIEWS)
  const [loading, setLoading] = useState(Boolean(tenantId))

  const reload = useCallback(async () => {
    if (!tenantId) {
      setViews(SEED_VIEWS)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await api.getSavedViews(tenantId, 'listings')
      const remote = (res.views || []).map((v) => v as unknown as SavedView)
      setViews([...SEED_VIEWS, ...remote.filter((v) => !v.id.startsWith('seed-'))])
    } catch {
      setViews(SEED_VIEWS)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void reload()
  }, [reload])

  const createView = useCallback(
    async (input: {
      name: string
      filter?: Record<string, unknown>
      sort?: unknown[]
      shared_with_tenant?: boolean
      column_prefs?: Record<string, unknown>
    }) => {
      if (!tenantId) throw new Error('No active tenant')
      const created = (await api.createSavedView(tenantId, {
        resource: 'listings',
        name: input.name,
        filter: input.filter || {},
        sort: input.sort || [],
        shared_with_tenant: !!input.shared_with_tenant,
        column_prefs: input.column_prefs || {},
      })) as unknown as SavedView
      setViews((prev) => [...prev, created])
      return created
    },
    [tenantId],
  )

  const renameView = useCallback(
    async (id: string, name: string) => {
      if (!tenantId || id.startsWith('seed-')) return
      const updated = (await api.updateSavedView(tenantId, id, { name })) as unknown as SavedView
      setViews((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)))
    },
    [tenantId],
  )

  const shareView = useCallback(
    async (id: string, shared: boolean) => {
      if (!tenantId || id.startsWith('seed-')) return
      const updated = (await api.updateSavedView(tenantId, id, {
        shared_with_tenant: shared,
      })) as unknown as SavedView
      setViews((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)))
    },
    [tenantId],
  )

  const deleteView = useCallback(
    async (id: string) => {
      if (!tenantId || id.startsWith('seed-')) return
      await api.deleteSavedView(tenantId, id)
      setViews((prev) => prev.filter((v) => v.id !== id))
    },
    [tenantId],
  )

  return { views, loading, createView, renameView, shareView, deleteView, reload }
}
