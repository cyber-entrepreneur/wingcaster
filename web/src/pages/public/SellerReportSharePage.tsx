/**
 * AGT-LST-015 — tokenized seller performance report (client-safe, unauthenticated).
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, BarChart3, Loader2, MapPin } from 'lucide-react'
import { api, type SellerReportPayload, type SellerReportStatus } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { usePageTitle } from '@/lib/usePageTitle'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; status: SellerReportStatus; payload: SellerReportPayload }

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function SellerReportSharePage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  usePageTitle('Property performance report')

  useEffect(() => {
    if (!shareToken) {
      setState({ kind: 'error', message: 'This report link is invalid.' })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const response = await api.getPublicSellerReport(shareToken)
        if (cancelled) return
        setState({ kind: 'ready', status: response.status, payload: response.payload })
      } catch {
        if (cancelled) return
        setState({ kind: 'error', message: 'This report is no longer available.' })
      }
    })()
    return () => { cancelled = true }
  }, [shareToken])

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--lc-surface-base)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <AlertTriangle className="mb-3 h-8 w-8 text-[var(--lc-status-unpublished-fg)]" />
        <h1 className="text-xl font-semibold">Report unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      </div>
    )
  }

  const { payload, status } = state

  return (
    <div className="min-h-screen bg-[var(--lc-surface-base)]">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {status === 'frozen' && (
          <div className="mb-4 rounded-md border border-[var(--lc-border-subtle)] bg-[var(--lc-surface-raised)] px-4 py-3 text-sm">
            Campaign ended — this is the final snapshot shared by your agent.
          </div>
        )}

        <div className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-inverse)] px-5 py-6 text-[var(--lc-text-on-inverse)]">
          <p className="text-xs uppercase tracking-wide text-[var(--lc-text-on-inverse-muted)]">Performance report</p>
          <h1 className="mt-1 text-2xl font-semibold">{payload.property.title}</h1>
          <p className="mt-2 flex items-center gap-1 text-sm text-[var(--lc-text-on-inverse-muted)]">
            <MapPin className="h-4 w-4" />
            {payload.property.location_label}
          </p>
          <p className="mt-4 text-sm sm:text-base">{payload.report.state_of_play}</p>
        </div>

        {payload.is_empty ? (
          <Card className="mt-6">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Your campaign just started. Your agent will share updated numbers here as marketing goes live.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <MetricCard label="Days on market" value={payload.summary.days_on_market} />
            <MetricCard label="Posts live" value={payload.summary.posts_count} />
            <MetricCard label="Inquiries received" value={payload.summary.inquiries_received} />
            <MetricCard label="Qualified leads" value={payload.summary.qualified_inquiries} />
          </div>
        )}

        {payload.report.agent_summary && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Agent update</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-[var(--lc-text-primary)]">
              {payload.report.agent_summary}
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Marketing activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload.marketing.channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">Your listing promotion is getting started.</p>
            ) : (
              payload.marketing.channels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium capitalize">{channel.platform}</p>
                    <p className="text-xs text-muted-foreground"><Numeric>{channel.views}</Numeric> views</p>
                  </div>
                  <Badge variant="published">Live</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Listing snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Ask:</span> {formatMoney(payload.property.price, payload.property.price_unit)}</p>
            <p><span className="text-muted-foreground">Inquiries shielded:</span> <Numeric>{payload.summary.shielded_inquiries}</Numeric></p>
            <p><span className="text-muted-foreground">Offers:</span> <Numeric>{payload.summary.offers_count}</Numeric></p>
          </CardContent>
        </Card>

        {payload.agent && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Prepared by {payload.agent.name}
            {payload.agent.agency_name ? ` · ${payload.agent.agency_name}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border-subtle)] bg-[var(--lc-surface-raised)] p-4 shadow-[var(--lc-elevation-sm)]">
      <p className="text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">{label}</p>
      <p className="mt-2 text-[length:var(--lc-type-display)] font-semibold">
        <Numeric>{value}</Numeric>
      </p>
    </div>
  )
}
