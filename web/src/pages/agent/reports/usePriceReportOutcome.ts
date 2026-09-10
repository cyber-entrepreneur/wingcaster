import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import type { AgentPriceReportRow } from './outcomeTypes'

const POLL_MS = 60_000

export type PriceOutcomeQuery = {
  report: AgentPriceReportRow | null
  loading: boolean
  notFound: boolean
  error: string | null
  refetch: () => Promise<void>
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Normalize brief-shaped `{ report, resolver, signal_placement }` into a list row. */
function normalizeOutcomePayload(payload: unknown, reportId: string): AgentPriceReportRow | null {
  if (!isRecord(payload)) return null

  if (typeof payload.id === 'string' && !isRecord(payload.report)) {
    return payload as AgentPriceReportRow
  }

  if (!isRecord(payload.report) || typeof payload.report.id !== 'string') return null

  const report = payload.report
  const resolver = isRecord(payload.resolver) ? payload.resolver : null
  const placement = isRecord(payload.signal_placement) ? payload.signal_placement : null
  const existingData = isRecord(report.data) ? report.data : {}
  const weight = typeof report.weight === 'number' ? report.weight : null
  const id = typeof report.id === 'string' && report.id ? report.id : reportId

  return {
    id,
    status: typeof report.status === 'string' ? report.status : 'pending',
    notes: typeof report.methodology_notes === 'string' ? report.methodology_notes : null,
    review_notes: resolver && typeof resolver.message === 'string' ? resolver.message : null,
    reason_code:
      resolver && typeof resolver.rejection_reason_code === 'string'
        ? resolver.rejection_reason_code
        : null,
    incorporated: weight === 100,
    incorporated_at: typeof report.effective_on === 'string' ? report.effective_on : null,
    reviewed_at: typeof report.decided_at === 'string' ? report.decided_at : null,
    created_at: typeof report.submitted_at === 'string' ? report.submitted_at : undefined,
    expires_at: typeof report.expires_at === 'string' ? report.expires_at : null,
    external_property_title: typeof report.title === 'string' ? report.title : null,
    segment_label:
      typeof report.market_segment_label === 'string' ? report.market_segment_label : null,
    superseded_by_report_id:
      typeof report.superseded_by_report_id === 'string' ? report.superseded_by_report_id : null,
    data: {
      ...existingData,
      weight: weight ?? undefined,
      signal_weight: weight ?? undefined,
      applied_weight: weight ?? undefined,
      picked_up_at: typeof report.picked_up_at === 'string' ? report.picked_up_at : null,
      more_info_summary:
        resolver && typeof resolver.more_info_summary === 'string'
          ? resolver.more_info_summary
          : null,
      methodology_notes:
        typeof report.methodology_notes === 'string' ? report.methodology_notes : null,
      attachments: Array.isArray(report.attachments) ? report.attachments : undefined,
      resolver: resolver
        ? {
            display_name: String(resolver.display_name || ''),
            avatar_url: typeof resolver.avatar_url === 'string' ? resolver.avatar_url : null,
          }
        : undefined,
      live_signal_url:
        placement && typeof placement.live_signal_url === 'string'
          ? placement.live_signal_url
          : null,
      public_profile_url:
        placement && typeof placement.public_profile_url === 'string'
          ? placement.public_profile_url
          : null,
    },
  }
}

/**
 * Load AGT-REC-003 outcome detail.
 *
 * Prefers `GET /api/users/me/price-reports/:id`.
 * Falls back to composing from `GET /api/pricing/my-agent-price-reports`.
 */
export function usePriceReportOutcome(reportId: string | undefined): PriceOutcomeQuery {
  const [report, setReport] = useState<AgentPriceReportRow | null>(null)
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
        const detail = await api.getMyPriceReportOutcome(reportId)
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

      const rows = (await api.getMyAgentPriceReports()) as AgentPriceReportRow[]
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
