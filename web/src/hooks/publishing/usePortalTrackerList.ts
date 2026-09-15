import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { PortalStatus } from '@/components/ui/portal-status-pill'
import {
  DEFAULT_TRACKER_FILTERS,
  type PortalTrackerFilters,
  type PortalTrackerListResponse,
  type PortalTrackerRow,
  TRACKER_STATUS_OPTIONS,
} from '@/hooks/publishing/types'

const STATUS_SET = new Set(TRACKER_STATUS_OPTIONS.map((o) => o.value))

function parseStatuses(raw: string | null): PortalStatus[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is PortalStatus => STATUS_SET.has(s as PortalStatus))
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function submittedWithinBounds(
  value: PortalTrackerFilters['submittedWithin'],
): { from?: string; to?: string } {
  if (!value) return {}
  const now = new Date()
  const to = now.toISOString()
  if (value === '7d') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { from: from.toISOString(), to }
  }
  if (value === '30d') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { from: from.toISOString(), to }
  }
  if (value === 'month') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return { from: from.toISOString(), to }
  }
  return {}
}

/** Read tracker filters from the current URL search params. */
export function filtersFromSearchParams(params: URLSearchParams): PortalTrackerFilters {
  const within = params.get('within') || params.get('submittedWithin') || ''
  const submittedWithin: PortalTrackerFilters['submittedWithin'] =
    within === '7d' || within === '30d' || within === 'month' ? within : ''
  return {
    status: parseStatuses(params.get('status')),
    portal: parseCsv(params.get('portal')),
    submittedWithin,
    q: (params.get('q') || '').trim(),
    listing_id: (params.get('listing_id') || '').trim(),
  }
}

/** Write filters into a URLSearchParams (clears empty keys). */
export function searchParamsFromFilters(filters: PortalTrackerFilters): URLSearchParams {
  const next = new URLSearchParams()
  if (filters.status.length) next.set('status', filters.status.join(','))
  if (filters.portal.length) next.set('portal', filters.portal.join(','))
  if (filters.submittedWithin) next.set('within', filters.submittedWithin)
  if (filters.q) next.set('q', filters.q)
  if (filters.listing_id) next.set('listing_id', filters.listing_id)
  return next
}

export function filtersToQueryParams(
  filters: PortalTrackerFilters,
  extra?: { after?: string; limit?: number },
): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.status.length) params.status = filters.status.join(',')
  if (filters.portal.length) params.portal = filters.portal.join(',')
  if (filters.q) params.q = filters.q
  if (filters.listing_id) params.listing_id = filters.listing_id
  const bounds = submittedWithinBounds(filters.submittedWithin)
  if (bounds.from) params.from = bounds.from
  if (bounds.to) params.to = bounds.to
  if (extra?.after) params.after = extra.after
  if (extra?.limit != null) params.limit = String(extra.limit)
  return params
}

export function filtersAreActive(filters: PortalTrackerFilters): boolean {
  return (
    filters.status.length > 0 ||
    filters.portal.length > 0 ||
    Boolean(filters.submittedWithin) ||
    Boolean(filters.q) ||
    Boolean(filters.listing_id)
  )
}

function normalizeListResponse(raw: unknown): PortalTrackerListResponse {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const rowsRaw = (body.rows ?? body.items ?? body.data ?? []) as PortalTrackerRow[]
  const rows = Array.isArray(rowsRaw) ? rowsRaw : []
  return {
    rows,
    next_cursor: (body.next_cursor as string | null) ?? null,
    has_more: Boolean(body.has_more),
    total: Number(body.total ?? rows.length) || 0,
  }
}

export type UsePortalTrackerListResult = {
  filters: PortalTrackerFilters
  setFilters: (next: PortalTrackerFilters | ((prev: PortalTrackerFilters) => PortalTrackerFilters)) => void
  clearFilters: () => void
  rows: PortalTrackerRow[]
  total: number
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  error: Error | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  patchRow: (id: string, patch: Partial<PortalTrackerRow>) => void
  filtersActive: boolean
}

/**
 * SWR-style cursor list for GET /api/publishing/tracker.
 * Filter state is URL-synced via `useSearchParams`.
 */
export function usePortalTrackerList(): UsePortalTrackerListResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams])
  const filtersActive = filtersAreActive(filters)

  const [rows, setRows] = useState<PortalTrackerRow[]>([])
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const requestSeq = useRef(0)

  const setFilters = useCallback(
    (next: PortalTrackerFilters | ((prev: PortalTrackerFilters) => PortalTrackerFilters)) => {
      setSearchParams(
        (prev) => {
          const current = filtersFromSearchParams(prev)
          const resolved = typeof next === 'function' ? next(current) : next
          return searchParamsFromFilters(resolved)
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_TRACKER_FILTERS)
  }, [setFilters])

  const fetchPage = useCallback(
    async (mode: 'replace' | 'append') => {
      const seq = ++requestSeq.current
      if (mode === 'replace') {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }
      try {
        const after = mode === 'append' ? cursor || undefined : undefined
        const raw = await api.getPublishingTracker(filtersToQueryParams(filters, { after, limit: 20 }))
        if (seq !== requestSeq.current) return
        const page = normalizeListResponse(raw)
        setRows((prev) => (mode === 'append' ? [...prev, ...page.rows] : page.rows))
        setTotal(page.total)
        setCursor(page.next_cursor)
        setHasMore(page.has_more)
        setError(null)
      } catch (err) {
        if (seq !== requestSeq.current) return
        setError(err instanceof Error ? err : new Error('Failed to load tracker'))
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [cursor, filters],
  )

  useEffect(() => {
    void fetchPage('replace')
    // Re-fetch when filters change; cursor intentionally omitted so replace resets pagination.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPage identity includes cursor
  }, [
    filters.status.join(','),
    filters.portal.join(','),
    filters.submittedWithin,
    filters.q,
    filters.listing_id,
  ])

  const refresh = useCallback(async () => {
    setCursor(null)
    await fetchPage('replace')
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return
    await fetchPage('append')
  }, [fetchPage, hasMore, loading, loadingMore])

  const patchRow = useCallback((id: string, patch: Partial<PortalTrackerRow>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.distribution_attempt_id === id ? { ...row, ...patch } : row,
      ),
    )
  }, [])

  return {
    filters,
    setFilters,
    clearFilters,
    rows,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    refresh,
    loadMore,
    patchRow,
    filtersActive,
  }
}
