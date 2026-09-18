/**
 * AGT-APR-006 — My submitted reports.
 *
 * A Pro agent's own valuation-evidence submissions in one place: sold-price
 * reports (WF-06) and bad-comparable reports (WF-05), each with submission
 * date, review status and the platform's decision. Rows deep-link to the
 * matching outcome screen (AGT-REC-003 / AGT-REC-002). Entry from the pricing
 * portfolio (AGT-APR-001).
 *
 * Read-only over pre-existing, reporter-scoped endpoints:
 *   GET /api/pricing/my-agent-price-reports
 *   GET /api/pricing/my-comparable-reports
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, FileText, Loader2, RefreshCw, Scale } from 'lucide-react'
import { api, type ComparableReportSummary } from '@/api/client'
import type { AgentPriceReport } from '@/types/marketPricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

type StatusTone = 'pending' | 'approved' | 'rejected' | 'neutral'

const STATUS_TONE: Record<StatusTone, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-green-200 bg-green-50 text-green-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
}

/** Map the many backend status strings onto a small set of visual tones. */
function toneForStatus(status?: string): StatusTone {
  const s = (status || '').toLowerCase()
  if (['verified', 'approved', 'accepted', 'incorporated', 'resolved'].includes(s)) return 'approved'
  if (['rejected', 'declined', 'dismissed'].includes(s)) return 'rejected'
  if (['pending', 'submitted', 'in_review', 'under_review', 'quarantined', 'escalated'].includes(s)) return 'pending'
  return 'neutral'
}

function humanizeStatus(status?: string): string {
  if (!status) return 'Pending'
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function StatusBadge({ status }: { status?: string }) {
  return (
    <Badge variant="outline" className={cn('w-fit text-[10px] capitalize', STATUS_TONE[toneForStatus(status)])}>
      {humanizeStatus(status)}
    </Badge>
  )
}

export function MySubmittedReportsPage() {
  const { agent } = useAuth()
  const navigate = useNavigate()
  usePageTitle('My submitted reports')

  const [priceReports, setPriceReports] = useState<AgentPriceReport[]>([])
  const [comparableReports, setComparableReports] = useState<ComparableReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const agentId = agent?.id

  const load = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    setError(null)
    try {
      const [price, comparable] = await Promise.all([api.getMyAgentPriceReports(), api.getMyComparableReports()])
      setPriceReports(price || [])
      setComparableReports(comparable || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your reports')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    if (agentId) void load()
  }, [agentId, load])

  const priceCount = priceReports.length
  const comparableCount = comparableReports.length
  const defaultTab = useMemo(() => (priceCount === 0 && comparableCount > 0 ? 'comparable' : 'price'), [priceCount, comparableCount])

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/agent/pricing" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Price Health
            </Link>
            <h1 className="text-3xl font-bold">My submitted reports</h1>
            <p className="text-muted-foreground">Track the review status and decision on every valuation-evidence report you have submitted.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] py-20 text-center">
            <span className="rounded-xl bg-red-50 p-4 text-red-600">
              <AlertTriangle className="h-8 w-8" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Couldn't load your reports</h2>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" onClick={() => void load()}>Try again</Button>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="price" className="gap-2">
                <FileText className="h-4 w-4" /> Sold-price <Numeric>{priceCount}</Numeric>
              </TabsTrigger>
              <TabsTrigger value="comparable" className="gap-2">
                <Scale className="h-4 w-4" /> Comparables <Numeric>{comparableCount}</Numeric>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="price">
              {priceReports.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-8 w-8" />}
                  title="No sold-price reports yet"
                  description="Report a completed sale from Price Health to contribute verified transaction evidence."
                  action={
                    <Link to="/agent/pricing/reports/new">
                      <Button size="sm">Report a sale</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--lc-border)]">
                  <TableHeader columns={['Property', 'Sold price', 'Submitted', 'Status']} template="2fr 1fr 1fr 0.9fr" />
                  {priceReports.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => navigate(`/agent/pricing/reports/${r.id}/outcome`)}
                      className="grid w-full grid-cols-[2fr_1fr_1fr_0.9fr] items-center gap-2 border-t border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-3 text-start text-sm transition-colors hover:bg-[var(--lc-bg-page)]"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {r.external_property_title || r.external_property_location || 'Listed property'}
                      </span>
                      <Numeric>{formatMoney(r.sold_price, r.currency)}</Numeric>
                      <span className="text-[13px] text-muted-foreground">{formatDate(r.sold_date || r.created_at)}</span>
                      <StatusBadge status={r.status} />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="comparable">
              {comparableReports.length === 0 ? (
                <EmptyState
                  icon={<Scale className="h-8 w-8" />}
                  title="No comparable reports yet"
                  description="Flag an inaccurate comparable from a valuation to open a review with Platform Admin."
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--lc-border)]">
                  <TableHeader columns={['Comparable', 'Submitted', 'Status', 'Decision']} template="2fr 1fr 0.9fr 1.1fr" />
                  {comparableReports.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => navigate(`/agent/comparable-reports/${r.id}`)}
                      className="grid w-full grid-cols-[2fr_1fr_0.9fr_1.1fr] items-center gap-2 border-t border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-3 text-start text-sm transition-colors hover:bg-[var(--lc-bg-page)]"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {r.reason || r.comparable_type || r.comparable_id || 'Comparable report'}
                      </span>
                      <span className="text-[13px] text-muted-foreground">{formatDate(r.created_at)}</span>
                      <StatusBadge status={r.status} />
                      <span className="truncate text-[13px] text-muted-foreground">
                        {r.decision_reason_code ? humanizeStatus(r.decision_reason_code) : r.reviewed_at ? 'Reviewed' : 'Awaiting review'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}

function TableHeader({ columns, template }: { columns: string[]; template: string }) {
  return (
    <div
      className="grid gap-2 bg-[var(--lc-surface-sunken)] px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((c) => (
        <span key={c}>{c}</span>
      ))}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface)] py-16 text-center">
      <span className="mb-4 rounded-xl bg-muted p-4 text-muted-foreground">{icon}</span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
