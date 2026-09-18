/**
 * AGN-REP-004 — Agency agent leaderboard (internal-only).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Loader2,
  Medal,
  Minus,
  RefreshCw,
  TrendingDown,
} from 'lucide-react'
import { api, type AgencyAgentLeaderboardResponse, type AgencyLeaderboardMetric } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { downloadCsv } from '@/lib/downloadCsv'
import { formatStat } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden' | 'empty'

const METRIC_LABELS: Record<AgencyLeaderboardMetric, string> = {
  revenue: 'Revenue attributed',
  closings: 'Listings closed',
  response_time: 'Median response time',
  conversion_rate: 'Conversion rate',
}

function defaultDateRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function formatMetricValue(metric: AgencyLeaderboardMetric, value: number | null | undefined) {
  if (value == null) return '—'
  if (metric === 'revenue') return `$${formatStat(value)}`
  if (metric === 'response_time') return `${value}m`
  if (metric === 'conversion_rate') return `${value}%`
  return formatStat(value)
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <ArrowUp className="h-4 w-4 text-[var(--lc-status-published-fg)]" aria-hidden="true" />
  if (trend === 'down') return <ArrowDown className="h-4 w-4 text-[var(--lc-status-unpublished-fg)]" aria-hidden="true" />
  return <Minus className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" />
}

function medalLabel(medal: string | null | undefined) {
  if (medal === 'gold') return '1st'
  if (medal === 'silver') return '2nd'
  if (medal === 'bronze') return '3rd'
  return null
}

export function AgencyAgentLeaderboardPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Agent leaderboard')

  const defaults = useMemo(() => defaultDateRange(), [])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AgencyAgentLeaderboardResponse | null>(null)
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [metric, setMetric] = useState<AgencyLeaderboardMetric>('revenue')

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const load = useCallback(async (filters?: {
    start_date?: string
    end_date?: string
    metric?: AgencyLeaderboardMetric
  }) => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const response = await api.getAgencyAgentLeaderboard({
        start_date: filters?.start_date ?? startDate,
        end_date: filters?.end_date ?? endDate,
        metric: filters?.metric ?? metric,
      })
      setData(response)
      setLoadState(response.leaderboard.length ? 'ready' : 'empty')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({
        title: 'Leaderboard unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }, [addToast, endDate, hasAgency, metric, startDate])

  useEffect(() => {
    if (authLoading) return
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, hasAgency])

  const exportReport = useCallback(() => {
    if (!data?.leaderboard.length) return
    const lines = [
      'rank,agent_name,revenue,closings,conversion_rate,median_response_minutes,inquiries,active_listings,trend',
      ...data.leaderboard.map((row) =>
        [
          row.rank,
          `"${row.agent_name.replace(/"/g, '""')}"`,
          row.revenue,
          row.closings,
          row.conversion_rate ?? '',
          row.median_response_minutes ?? '',
          row.inquiries,
          row.active_listings,
          row.trend,
        ].join(','),
      ),
    ]
    downloadCsv(lines.join('\n'), 'agency-agent-leaderboard.csv')
  }, [data])

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--lc-bg-page)]" data-screen="AGN-REP-004" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-hidden="true" />
        <span className="sr-only">Loading agent leaderboard</span>
      </div>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center" data-screen="AGN-REP-004" dir={dir}>
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-warning-fg)]" />
        <h1 className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-title)' }}>
          Agent leaderboard unavailable
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          You need an active agency membership to view the internal agent leaderboard.
        </p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center" data-screen="AGN-REP-004" dir={dir}>
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-unpublished-fg)]" />
        <h1 className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-title)' }}>
          Could not load leaderboard
        </h1>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-REP-004" dir={dir}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              to="/agency/reports"
              className="inline-flex items-center gap-2 text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to reports
            </Link>
            <h1
              className="mt-3 text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-display)', letterSpacing: 'var(--lc-tracking-display)' }}
            >
              Agent leaderboard
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--lc-text-muted)]">
              Internal-only rankings by revenue, closings, response time, and conversion rate.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={exportReport} disabled={!data?.leaderboard.length}>
            <Download className="me-2 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Choose ranking metric and date range.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Rank by</span>
              <select
                value={metric}
                onChange={(event) => setMetric(event.target.value as AgencyLeaderboardMetric)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              >
                {(data?.available_metrics || ['revenue', 'closings', 'response_time', 'conversion_rate']).map((key) => (
                  <option key={key} value={key}>{METRIC_LABELS[key as AgencyLeaderboardMetric]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              />
            </label>
          </CardContent>
          <div className="border-t border-[var(--lc-border)] px-6 py-3">
            <Button size="sm" onClick={() => void load({ start_date: startDate, end_date: endDate, metric })}>
              Apply filters
            </Button>
          </div>
        </Card>

        {loadState === 'empty' ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <TrendingDown className="h-10 w-10 text-[var(--lc-text-muted)]" />
              <p className="text-[var(--lc-text-muted)]">No agent activity matches the selected filters.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{METRIC_LABELS[metric]}</CardTitle>
              <CardDescription>
                <Numeric>{data?.summary.agents_ranked ?? 0}</Numeric> agents ranked ·{' '}
                <Numeric>{data?.summary.total_closings ?? 0}</Numeric> closings
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--lc-border)] text-start text-[var(--lc-text-muted)]">
                    <th className="px-3 py-2 font-medium">Rank</th>
                    <th className="px-3 py-2 font-medium">Agent</th>
                    <th className="px-3 py-2 font-medium">{METRIC_LABELS[metric]}</th>
                    <th className="px-3 py-2 font-medium">Revenue</th>
                    <th className="px-3 py-2 font-medium">Closings</th>
                    <th className="px-3 py-2 font-medium">Response</th>
                    <th className="px-3 py-2 font-medium">Conversion</th>
                    <th className="px-3 py-2 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.leaderboard || []).map((row) => {
                    const medal = medalLabel(row.medal)
                    return (
                      <tr key={row.agent_id} className="border-b border-[var(--lc-border)]">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Numeric>{row.rank}</Numeric>
                            {medal ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lc-surface-sunken)] px-2 py-0.5 text-xs">
                                <Medal className="h-3.5 w-3.5" aria-hidden="true" />
                                {medal}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Link to={row.member_href} className="font-medium text-[var(--lc-text-heading)] hover:underline">
                            {row.agent_name}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <Numeric>{formatMetricValue(metric, row.metric_value)}</Numeric>
                        </td>
                        <td className="px-3 py-3"><Numeric>${formatStat(row.revenue)}</Numeric></td>
                        <td className="px-3 py-3"><Numeric>{row.closings}</Numeric></td>
                        <td className="px-3 py-3">
                          <Numeric>{row.median_response_minutes != null ? `${row.median_response_minutes}m` : '—'}</Numeric>
                        </td>
                        <td className="px-3 py-3">
                          <Numeric>{row.conversion_rate != null ? `${row.conversion_rate}%` : '—'}</Numeric>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 capitalize">
                            <TrendIcon trend={row.trend} />
                            {row.trend}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {data?.generated_at && (
          <p className="text-xs text-[var(--lc-text-muted)]">
            Generated at <Numeric>{new Date(data.generated_at).toLocaleString()}</Numeric>
          </p>
        )}
      </div>
    </div>
  )
}
