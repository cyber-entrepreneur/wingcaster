import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import type { ComparableReportRow } from './outcomeTypes'

const POLL_MS = 60_000

export type ComparableOutcomeQuery = {
  report: ComparableReportRow | null
  loading: boolean
  notFound: boolean
  error: string | null
  refetch: () => Promise<void>
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Normalize brief-shaped `{ report, comparable, resolver, impact }` into a list row. */
function normalizeOutcomePayload(payload: unknown, reportId: string): ComparableReportRow | null {
  if (!isRecord(payload)) return null

  if (typeof payload.id === 'string' && !isRecord(payload.report)) {
    return payload as ComparableReportRow
  }

  if (!isRecord(payload.report) || typeof payload.report.id !== 'string') return null

  const report = payload.report
  const comparable = isRecord(payload.comparable) ? payload.comparable : null
  const resolver = isRecord(payload.resolver) ? payload.resolver : null
  const impact = isRecord(payload.impact) ? payload.impact : null
  const existingData = isRecord(report.data) ? report.data : {}
  const existingDecision = isRecord(existingData.decision) ? existingData.decision : {}

  const action =
    typeof report.action === 'string'
      ? report.action
      : typeof existingDecision.action === 'string'
        ? existingDecision.action
        : undefined

  const id = typeof report.id === 'string' && report.id ? report.id : reportId

  return {
    id,
    status: typeof report.status === 'string' ? report.status : 'pending',
    reason: typeof report.reason_code === 'string' ? report.reason_code : undefined,
    notes: typeof report.notes === 'string' ? report.notes : null,
    comparable_id: comparable && typeof comparable.id === 'string' ? comparable.id : undefined,
    submitted_at: typeof report.submitted_at === 'string' ? report.submitted_at : undefined,
    created_at: typeof report.submitted_at === 'string' ? report.submitted_at : undefined,
    picked_up_at: typeof report.picked_up_at === 'string' ? report.picked_up_at : null,
    decided_at: typeof report.decided_at === 'string' ? report.decided_at : null,
    resolved_at: typeof report.resolved_at === 'string' ? report.resolved_at : null,
    expires_at: typeof report.expires_at === 'string' ? report.expires_at : null,
    superseded_by_report_id:
      typeof report.superseded_by_report_id === 'string' ? report.superseded_by_report_id : null,
    sla_hours: typeof report.sla_hours === 'number' ? report.sla_hours : undefined,
    decision_notes: resolver && typeof resolver.message === 'string' ? resolver.message : null,
    data: {
      ...existingData,
      comparable: comparable
        ? {
            address_label: String(comparable.address_label || ''),
            market_label: String(comparable.market_label || ''),
            source_label: String(comparable.source_label || ''),
          }
        : undefined,
      evidence: Array.isArray(report.evidence) ? report.evidence : undefined,
      decision: {
        ...existingDecision,
        action,
        notes: resolver && typeof resolver.message === 'string' ? resolver.message : undefined,
        market_impact: impact
          ? {
              valuations_affected:
                typeof impact.affected_listings_count === 'number'
                  ? impact.affected_listings_count
                  : undefined,
            }
          : undefined,
        resolver: resolver
          ? {
              display_name: String(resolver.display_name || ''),
              avatar_url: typeof resolver.avatar_url === 'string' ? resolver.avatar_url : null,
            }
          : undefined,
      },
    },
  }
}

/**
 * Load AGT-REC-002 outcome detail.
 *
 * Prefers `GET /api/users/me/comparable-reports/:id` (brief contract).
 * Falls back to composing from `GET /api/pricing/my-comparable-reports`
 * when the thin alias is not yet available. Missing ids → not-found.
 */
export function useComparableReportOutcome(reportId: string | undefined): ComparableOutcomeQuery {
  const [report, setReport] = useState<ComparableReportRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!reportId) {
      setNotFound(true)
      setReport(null)
      setLoading(false)
      return
    }
    try {
      setError(null)

      try {
        const detail = await api.getMyComparableReportOutcome(reportId)
        const normalized = normalizeOutcomePayload(detail, reportId)
        if (normalized) {
          setNotFound(false)
          setReport(normalized)
          return
        }
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status
        if (status && status !== 404) throw err
      }

      const rows = (await api.getMyComparableReports()) as ComparableReportRow[]
      const list = Array.isArray(rows) ? rows : []
      const hit = list.find((r) => r.id === reportId) ?? null
      if (!hit) {
        setNotFound(true)
        setReport(null)
      } else {
        setNotFound(false)
        setReport(hit)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    setLoading(true)
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!reportId || notFound) return undefined
    const id = window.setInterval(() => {
      void refetch()
    }, POLL_MS)
    const onFocus = () => {
      void refetch()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [reportId, notFound, refetch])

  return { report, loading, notFound, error, refetch }
}
