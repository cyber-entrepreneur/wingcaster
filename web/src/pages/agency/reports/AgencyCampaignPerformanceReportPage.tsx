/**
 * AGN-REP-006 — Agency campaign performance report.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Loader2,
  Megaphone,
  RefreshCw,
  TrendingDown,
} from 'lucide-react'
import { api, type AgencyCampaignPerformanceResponse } from '@/api/client'
import { HorizontalBarChart } from '@/components/dashboard/HorizontalBarChart'
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

function defaultDateRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export function AgencyCampaignPerformanceReportPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Campaign performance')

  const defaults = useMemo(() => defaultDateRange(), [])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AgencyCampaignPerformanceResponse | null>(null)
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [channelFilter, setChannelFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const load = useCallback(async (filters?: {
    start_date?: string
    end_date?: string
    channel?: string
    agent_id?: string
  }) => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const response = await api.getAgencyCampaignPerformance({
        start_date: filters?.start_date ?? startDate,
        end_date: filters?.end_date ?? endDate,
        channel: filters?.channel ?? (channelFilter || undefined),
        agent_id: filters?.agent_id ?? (agentFilter || undefined),
      })
      setData(response)
      setLoadState(response.rows.length ? 'ready' : 'empty')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({
        title: 'Campaign report unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }, [addToast, agentFilter, channelFilter, endDate, hasAgency, startDate])

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
    if (!data?.rows.length) return
    const lines = [
      'id,name,status,channel,agent_name,enrollments_total,enrollments_completed,completion_rate,messages_sent,messages_delivered,delivery_rate',
      ...data.rows.map((row) =>
        [
          row.id,
          `"${row.name.replace(/"/g, '""')}"`,
          row.status,
          row.channel,
          row.agent_name || '',
          row.enrollments_total,
          row.enrollments_completed,
          row.completion_rate ?? '',
          row.messages_sent,
          row.messages_delivered,
          row.delivery_rate ?? '',
        ].join(','),
      ),
    ]
    downloadCsv(lines.join('\n'), 'agency-campaign-performance.csv')
  }, [data])

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--lc-bg-page)]" data-screen="AGN-REP-006" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-hidden="true" />
        <span className="sr-only">Loading campaign performance</span>
      </div>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center" data-screen="AGN-REP-006" dir={dir}>
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-warning-fg)]" />
        <h1 className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-title)' }}>
          Campaign report unavailable
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          You need an active agency membership to view campaign performance.
        </p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center" data-screen="AGN-REP-006" dir={dir}>
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-unpublished-fg)]" />
        <h1 className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-title)' }}>
          Could not load campaign report
        </h1>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  const overview = data?.overview

  return (
    <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-REP-006" dir={dir}>
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
              className="mt-3 flex items-center gap-2 text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-display)', letterSpacing: 'var(--lc-tracking-display)' }}
            >
              <Megaphone className="h-8 w-8" aria-hidden="true" />
              Campaign performance
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--lc-text-muted)]">
              Marketing campaign KPIs across agents with enrollments, delivery, and completion rates.
              For funnel → commission → ROAS with attribution models, open{' '}
              <Link
                to="/agency/reports/attribution"
                className="text-[var(--lc-text-primary)] underline underline-offset-2"
              >
                Attribution &amp; commission
              </Link>
              .
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={exportReport} disabled={!data?.rows.length}>
            <Download className="me-2 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Refine by date range, channel, and owning agent.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">End date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Channel</span>
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2">
                <option value="">All channels</option>
                {(data?.filter_options.channels || []).map((channel) => (
                  <option key={channel} value={channel}>{channel}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Agent</span>
              <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2">
                <option value="">All agents</option>
                {(data?.filter_options.agents || []).map((agentOption) => (
                  <option key={agentOption.id} value={agentOption.id}>{agentOption.name}</option>
                ))}
              </select>
            </label>
          </CardContent>
          <div className="border-t border-[var(--lc-border)] px-6 py-3">
            <Button size="sm" onClick={() => void load({ start_date: startDate, end_date: endDate, channel: channelFilter, agent_id: agentFilter })}>
              Apply filters
            </Button>
          </div>
        </Card>

        {loadState === 'empty' ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <TrendingDown className="h-10 w-10 text-[var(--lc-text-muted)]" />
              <p className="text-[var(--lc-text-muted)]">No campaigns match the selected filters.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Campaigns" value={overview?.campaigns || 0} />
              <MetricCard label="Active" value={overview?.active_campaigns || 0} />
              <MetricCard label="Enrollments" value={overview?.total_enrollments || 0} />
              <MetricCard label="Messages sent" value={overview?.messages_sent || 0} />
              <MetricCard label="Completion rate" value={overview?.completion_rate != null ? `${overview.completion_rate}%` : '—'} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Messages by channel</CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalBarChart
                  items={(data?.by_channel || []).map((row) => ({ label: row.channel, value: row.messages_sent }))}
                  emptyLabel="No message activity in range"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaigns</CardTitle>
                <CardDescription>Drill into a campaign for step and enrollment detail.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--lc-border)] text-start text-[var(--lc-text-muted)]">
                      <th className="px-3 py-2 font-medium">Campaign</th>
                      <th className="px-3 py-2 font-medium">Agent</th>
                      <th className="px-3 py-2 font-medium">Channel</th>
                      <th className="px-3 py-2 font-medium">Enrollments</th>
                      <th className="px-3 py-2 font-medium">Completed</th>
                      <th className="px-3 py-2 font-medium">Sent</th>
                      <th className="px-3 py-2 font-medium">Delivered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.rows || []).map((row) => (
                      <tr key={row.id} className="border-b border-[var(--lc-border)]">
                        <td className="px-3 py-3">
                          <Link to={row.href} className="font-medium text-[var(--lc-text-heading)] hover:underline">
                            {row.name}
                          </Link>
                          <p className="text-xs capitalize text-[var(--lc-text-muted)]">{row.status}</p>
                        </td>
                        <td className="px-3 py-3">{row.agent_name || '—'}</td>
                        <td className="px-3 py-3 capitalize">{row.channel}</td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.enrollments_total)}</Numeric></td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.enrollments_completed)}</Numeric></td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.messages_sent)}</Numeric></td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.messages_delivered)}</Numeric></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
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

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-[var(--lc-text-muted)]">{label}</p>
        <p className="mt-1 text-3xl font-bold text-[var(--lc-text-heading)]">
          <Numeric>{typeof value === 'number' ? formatStat(value) : value}</Numeric>
        </p>
      </CardContent>
    </Card>
  )
}
