/**
 * PA-ARE-003 — Review AI-signaled POIs for one area (verify/reject).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'

interface AreaSummary {
  id: string
  name: string
  slug?: string
  status?: string
}

interface AreaSignal {
  id: string
  signal_type: string
  status: string
  source_type_id?: string
  raw_content?: string | null
  extracted_features?: Record<string, unknown> | string | null
  fetched_at?: string | null
  created_at?: string | null
}

const REVIEWABLE_STATUSES = new Set(['pending_extraction', 'extracted'])

function parseFeatures(raw: AreaSignal['extracted_features']): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return raw
}

function signalLabel(signal: AreaSignal): string {
  const features = parseFeatures(signal.extracted_features)
  const category = features.category
  const dimension = features.dimension_slug
  if (typeof category === 'string' && category) return category
  if (typeof dimension === 'string' && dimension) return dimension
  return signal.signal_type
}

function signalConfidence(signal: AreaSignal): number | null {
  const features = parseFeatures(signal.extracted_features)
  const value = Number(features.value)
  const max = Number(features.max)
  if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
    return value / max
  }
  const confidence = Number(features.confidence)
  return Number.isFinite(confidence) ? confidence : null
}

export function AreaSignalsReviewPage() {
  const { areaId = '' } = useParams()
  const { isAdmin } = useAuth()
  const { addToast } = useToast()

  const [area, setArea] = useState<AreaSummary | null>(null)
  const [signals, setSignals] = useState<AreaSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('reviewable')
  const [bulkThreshold, setBulkThreshold] = useState('0.7')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!areaId) return
    setLoading(true)
    try {
      const [areaRes, signalRes] = await Promise.all([
        api.getAdminArea(areaId) as Promise<AreaSummary>,
        api.listAdminSignals({ areaId, limit: '200' }) as Promise<{ items: AreaSignal[] }>,
      ])
      setArea(areaRes)
      setSignals(signalRes.items || [])
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to load signals',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, areaId])

  useEffect(() => {
    if (!isAdmin || !areaId) return
    void reload()
  }, [areaId, isAdmin, reload])

  const filteredSignals = useMemo(() => {
    if (statusFilter === 'all') return signals
    if (statusFilter === 'reviewable') {
      return signals.filter((signal) => REVIEWABLE_STATUSES.has(signal.status))
    }
    return signals.filter((signal) => signal.status === statusFilter)
  }, [signals, statusFilter])

  async function verifySignal(signal: AreaSignal) {
    setBusyId(signal.id)
    try {
      await api.verifyAdminSignal(signal.id, 'Verified from area signals review')
      addToast({ variant: 'success', title: 'Signal verified' })
      await reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Verify failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  async function rejectSignal(signal: AreaSignal) {
    setBusyId(signal.id)
    try {
      await api.rejectAdminSignal(signal.id, 'Rejected from area signals review')
      addToast({ variant: 'success', title: 'Signal rejected' })
      await reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Reject failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  async function bulkVerifyAboveThreshold() {
    const threshold = Number(bulkThreshold)
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      addToast({ variant: 'error', title: 'Threshold must be between 0 and 1.' })
      return
    }
    const candidates = signals.filter((signal) => {
      if (!REVIEWABLE_STATUSES.has(signal.status)) return false
      const confidence = signalConfidence(signal)
      return confidence != null && confidence >= threshold
    })
    if (!candidates.length) {
      addToast({ variant: 'error', title: 'No reviewable signals meet that threshold.' })
      return
    }

    setBulkBusy(true)
    try {
      for (const signal of candidates) {
        await api.verifyAdminSignal(signal.id, `Bulk verified at threshold ${threshold}`)
      }
      addToast({
        variant: 'success',
        title: 'Bulk verify complete',
        description: `${candidates.length} signal(s) verified`,
      })
      await reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Bulk verify failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBulkBusy(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="container py-8 text-sm text-[var(--lc-text-danger)]">
        Platform admin access required.
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/admin/areas" className="text-sm text-[var(--lc-text-brand)] hover:underline">
          ← Back to areas
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Signals review</h1>
          <p className="text-sm text-[var(--lc-text-muted)]">
            {area?.name || areaId}
            {area?.slug ? ` · ${area.slug}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="signal-status-filter" className="text-xs">Status filter</Label>
            <select
              id="signal-status-filter"
              className="mt-1 min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="reviewable">Reviewable</option>
              <option value="all">All</option>
              <option value="pending_extraction">Pending extraction</option>
              <option value="extracted">Extracted</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <Label htmlFor="bulk-threshold" className="text-xs">Bulk verify threshold</Label>
            <Input
              id="bulk-threshold"
              inputMode="decimal"
              value={bulkThreshold}
              onChange={(e) => setBulkThreshold(e.target.value)}
              className="mt-1 w-24 font-mono"
            />
          </div>
          <Button
            variant="outline"
            disabled={bulkBusy || loading}
            onClick={() => void bulkVerifyAboveThreshold()}
          >
            Bulk verify
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Signal queue (<Numeric>{filteredSignals.length}</Numeric>)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
          ) : filteredSignals.length === 0 ? (
            <p className="text-sm text-[var(--lc-text-muted)]">No signals match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[var(--lc-surface-sunken)] text-start">
                  <tr>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Label</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Confidence</th>
                    <th className="px-3 py-2 font-medium">Fetched</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSignals.map((signal) => {
                    const confidence = signalConfidence(signal)
                    const reviewable = REVIEWABLE_STATUSES.has(signal.status)
                    return (
                      <tr key={signal.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{signal.signal_type}</td>
                        <td className="px-3 py-2">{signalLabel(signal)}</td>
                        <td className="px-3 py-2">
                          <Badge variant={signal.status === 'verified' ? 'default' : 'secondary'}>
                            {signal.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {confidence == null ? '—' : (
                            <Numeric>{confidence.toFixed(2)}</Numeric>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[var(--lc-text-muted)]">
                          {signal.fetched_at || signal.created_at
                            ? new Date(String(signal.fetched_at || signal.created_at)).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {reviewable ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === signal.id || bulkBusy}
                                onClick={() => void verifySignal(signal)}
                              >
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === signal.id || bulkBusy}
                                onClick={() => void rejectSignal(signal)}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[var(--lc-text-muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AreaSignalsReviewPage
