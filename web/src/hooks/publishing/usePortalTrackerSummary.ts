import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { filtersToQueryParams } from '@/hooks/publishing/usePortalTrackerList'
import type {
  PortalTrackerFilters,
  PortalTrackerSummaryResponse,
} from '@/hooks/publishing/types'

export type UsePortalTrackerSummaryResult = {
  summary: PortalTrackerSummaryResponse | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
  /** Soft invalidate — used by WebSocket push handlers. */
  invalidate: () => void
}

function normalizeSummary(raw: unknown): PortalTrackerSummaryResponse {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const top = body.top_failure_class as PortalTrackerSummaryResponse['top_failure_class'] | null
  return {
    scope: (body.scope as PortalTrackerSummaryResponse['scope']) || {
      from: null,
      to: null,
      filters_applied: { status: [], portal: [], listing_id: null, from: null, to: null },
    },
    total_submissions: Number(body.total_submissions) || 0,
    success_rate: Number(body.success_rate) || 0,
    credits_spent: Number(body.credits_spent) || 0,
    top_failure_class: top ?? null,
    by_status: (body.by_status as PortalTrackerSummaryResponse['by_status']) || undefined,
  }
}

/**
 * GET /api/publishing/tracker/summary — KPI aggregate, keyed on the same filters.
 * Auto-invalidates when `invalidate()` is called (WebSocket status_changed).
 */
export function usePortalTrackerSummary(
  filters: PortalTrackerFilters,
): UsePortalTrackerSummaryResult {
  const [summary, setSummary] = useState<PortalTrackerSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    try {
      const raw = await api.getPublishingTrackerSummary(filtersToQueryParams(filters))
      if (id !== seq.current) return
      setSummary(normalizeSummary(raw))
      setError(null)
    } catch (err) {
      if (id !== seq.current) return
      setError(err instanceof Error ? err : new Error('Failed to load tracker summary'))
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [
    load,
    tick,
    filters.status.join(','),
    filters.portal.join(','),
    filters.submittedWithin,
    filters.q,
    filters.listing_id,
  ])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  const invalidate = useCallback(() => {
    setTick((n) => n + 1)
  }, [])

  return { summary, loading, error, refresh, invalidate }
}
