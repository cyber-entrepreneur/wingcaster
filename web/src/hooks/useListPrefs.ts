import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'

export type ListingsColumnId =
  | 'hrid'
  | 'title'
  | 'price'
  | 'status'
  | 'portals'
  | 'inquiries'
  | 'views'
  | 'dom'
  | 'updated'
  | 'owner'
  | 'actions'

export const DEFAULT_LISTINGS_COLUMNS: ListingsColumnId[] = [
  'hrid',
  'title',
  'price',
  'status',
  'portals',
  'inquiries',
  'views',
  'dom',
  'updated',
  'actions',
]

export interface ListingsListPrefs {
  columns: ListingsColumnId[]
  widths: Record<string, number>
  density: 'compact' | 'comfortable' | 'spacious'
  default_sort: Array<[string, 'asc' | 'desc']>
  default_filter: Record<string, unknown>
}

const DEFAULT_PREFS: ListingsListPrefs = {
  columns: DEFAULT_LISTINGS_COLUMNS,
  widths: {},
  density: 'comfortable',
  default_sort: [['updated', 'desc']],
  default_filter: {},
}

function normalizePrefs(raw: Record<string, unknown> | undefined): ListingsListPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS }
  const columns = Array.isArray(raw.columns)
    ? (raw.columns.filter((c) => typeof c === 'string') as ListingsColumnId[])
    : DEFAULT_LISTINGS_COLUMNS
  return {
    columns: columns.length ? columns : DEFAULT_LISTINGS_COLUMNS,
    widths: (raw.widths && typeof raw.widths === 'object' ? raw.widths : {}) as Record<string, number>,
    density:
      raw.density === 'compact' || raw.density === 'spacious' || raw.density === 'comfortable'
        ? raw.density
        : 'comfortable',
    default_sort: Array.isArray(raw.default_sort)
      ? (raw.default_sort as Array<[string, 'asc' | 'desc']>)
      : DEFAULT_PREFS.default_sort,
    default_filter:
      raw.default_filter && typeof raw.default_filter === 'object'
        ? (raw.default_filter as Record<string, unknown>)
        : {},
  }
}

export interface UseListPrefsResult {
  prefs: ListingsListPrefs
  loading: boolean
  savePrefs: (patch: Partial<ListingsListPrefs>) => Promise<void>
  reload: () => Promise<void>
}

/** AGT-LST-002 — PATCH /api/users/me/list-prefs */
export function useListPrefs(tenantId?: string | null): UseListPrefsResult {
  const [prefs, setPrefs] = useState<ListingsListPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getListPrefs(tenantId || undefined)
      setPrefs(normalizePrefs(res.listings as Record<string, unknown>))
    } catch {
      setPrefs({ ...DEFAULT_PREFS })
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void reload()
  }, [reload])

  const savePrefs = useCallback(async (patch: Partial<ListingsListPrefs>) => {
    const next = {
      ...prefs,
      ...patch,
      widths: { ...prefs.widths, ...(patch.widths || {}) },
    }
    setPrefs(next)
    await api.patchListPrefs(next)
  }, [prefs])

  return { prefs, loading, savePrefs, reload }
}
