/**
 * AGN-REP-001 — Agency reports home.
 *
 * Landing page for agency-wide reports with preview cards linking to
 * detail reports (listings, funnel, leaderboard, credits, campaigns,
 * white-label traffic, revenue attribution) plus a custom report entry.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Loader2,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { api, type AgencyReportsHomeCard, type AgencyReportsHomeResponse } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { formatStat } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

function ReportSparkline({ values }: { values: number[] }) {
  const safe = values.length ? values : [0]
  const max = Math.max(...safe, 1)
  const min = Math.min(...safe)
  const range = max - min || 1

  return (
    <div
      className="flex h-12 items-end gap-0.5"
      aria-hidden="true"
      data-testid="report-sparkline"
    >
      {safe.map((value, index) => {
        const height = Math.max(((value - min) / range) * 100, value > 0 ? 12 : 4)
        return (
          <div
            key={index}
            className="flex-1 rounded-t bg-[var(--lc-action-primary)]/70"
            style={{ height: `${height}%` }}
          />
        )
      })}
    </div>
  )
}

function ReportPreviewCard({ card }: { card: AgencyReportsHomeCard }) {
  const secondary =
    card.secondary_label && card.secondary_value != null
      ? `${card.secondary_label}: ${formatStat(card.secondary_value)}`
      : card.secondary_label

  return (
    <Link
      to={card.href}
      className="group block rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)] transition-colors hover:border-[var(--lc-border-strong)] hover:bg-[var(--lc-surface-selected)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-focus-ring)]"
      data-report-id={card.report_id}
      data-testid={`report-card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
          >
            {card.report_id}
          </p>
          <h2
            className="mt-1 text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-title-sm)' }}
          >
            {card.title}
          </h2>
        </div>
        <TrendingUp
          className="h-5 w-5 shrink-0 text-[var(--lc-text-muted)] transition-colors group-hover:text-[var(--lc-action-primary)]"
          aria-hidden="true"
        />
      </div>

      <div className="mt-[var(--lc-space-md)]">
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {card.kpi_label}
        </p>
        <Numeric
          className="mt-1 text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-display)', letterSpacing: 'var(--lc-tracking-display)' }}
        >
          {formatStat(card.kpi_value)}
        </Numeric>
        {secondary ? (
          <p className="mt-1 text-sm text-[var(--lc-text-muted)]">{secondary}</p>
        ) : null}
      </div>

      <div className="mt-[var(--lc-space-md)]">
        <ReportSparkline values={card.trend} />
      </div>
    </Link>
  )
}

export function AgencyReportsHomePage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Reports')

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AgencyReportsHomeResponse | null>(null)

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const load = useCallback(async () => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const response = await api.getAgencyReportsHome()
      setData(response)
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({
        title: 'Reports unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }, [addToast, hasAgency])

  useEffect(() => {
    if (authLoading) return
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, hasAgency])

  if (authLoading || loadState === 'loading') {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center bg-[var(--lc-bg-page)]"
        data-screen="AGN-REP-001"
        dir={dir}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-hidden="true" />
        <span className="sr-only">Loading reports</span>
      </div>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <div
        className="mx-auto max-w-3xl px-4 py-10 text-center"
        data-screen="AGN-REP-001"
        dir={dir}
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-warning-fg)]" />
        <h1 className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-title)' }}>
          Agency reports unavailable
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          You need an active agency membership to view agency-wide reports.
        </p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div
        className="mx-auto max-w-3xl px-4 py-10 text-center"
        data-screen="AGN-REP-001"
        dir={dir}
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-unpublished-fg)]" />
        <h1 className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-title)' }}>
          Could not load reports
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">Try refreshing the page.</p>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-REP-001" dir={dir}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[var(--lc-text-muted)]">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
              <span style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}>
                Agency reports
              </span>
            </div>
            <h1
              className="mt-2 text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-display)', letterSpacing: 'var(--lc-tracking-display)' }}
            >
              Reports home
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--lc-text-muted)]">
              Preview agency-wide performance and drill into detailed reports for listings, leads,
              agents, credits, campaigns, white-label traffic, and revenue.
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0 self-start">
            <Link to="/agency/reports/custom/new">
              <Plus className="me-2 h-4 w-4" aria-hidden="true" />
              Custom report
            </Link>
          </Button>
        </div>

        <Card className="mt-6 border-[var(--lc-border)] bg-[var(--lc-surface)]">
          <CardHeader className="pb-2">
            <CardTitle style={{ font: 'var(--lc-type-title-sm)' }}>Overview</CardTitle>
            <CardDescription>
              Last {data?.window_days ?? 30} days ·{' '}
              <Numeric>{data?.totals.listings ?? 0}</Numeric> listings ·{' '}
              <Numeric>{data?.totals.inquiries ?? 0}</Numeric> inquiries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(data?.cards ?? []).map((card) => (
                <ReportPreviewCard key={card.id} card={card} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
