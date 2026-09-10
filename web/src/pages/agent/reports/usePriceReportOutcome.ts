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

/**
 * Compose outcome detail from live `GET /pricing/my-agent-price-reports`.
 *
 * Thin alias gap: briefs prefer `GET /api/users/me/price-reports/:id` —
 * not present; list composition is the adaptation.
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
