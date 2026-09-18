/**
 * AGN-REP-007 — Revenue attribution (agency reports).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  TrendingDown,
} from 'lucide-react'
import { api, type AgencyRevenueAttributionResponse } from '@/api/client'
import { HorizontalBarChart } from '@/components/dashboard/HorizontalBarChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { downloadCsv } from '@/lib/downloadCsv'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

function defaultDateRange() {
  const end = new Date()
  const start = new Date(end)
  start.setMonth(start.getMonth() - 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function formatMoney(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export function RevenueAttributionReportPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Revenue attribution')

  const defaults = useMemo(() => defaultDateRange(), [])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AgencyRevenueAttributionResponse | null>(null)
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [channelFilter, setChannelFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')

  const affiliation = (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const load = useCallback(async (filters?: {
    start_date?: string
    end_date?: string
    channel?: string
    agent_id?: string
    campaign_id?: string
  }) => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const response = await api.getAgencyRevenueAttribution({
        start_date: filters?.start_date ?? startDate,
        end_date: filters?.end_date ?? endDate,
        channel: filters?.channel ?? (channelFilter || undefined),
        agent_id: filters?.agent_id ?? (agentFilter || undefined),
        campaign_id: filters?.campaign_id ?? (campaignFilter || undefined),
      })
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
        title: 'Revenue attribution unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }, [addToast, agentFilter, campaignFilter, channelFilter, endDate, hasAgency, startDate])

  useEffect(() => {
    if (authLoading || !hasAgency) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, hasAgency])

  const currency = data?.summary.currency || 'USD'
  const isEmpty = !data?.summary.transaction_count

  const exportReport = useCallback(() => {
    if (!data) return
    const lines = [
      'id,closed_at,agent,channel,revenue,currency,transaction_type,listing_id,campaign',
      ...data.transactions.map(
        (row) =>
          `${row.id},${row.closed_at},${row.agent_name},${row.attribution_source},${row.final_sold_price},${row.currency},${row.transaction_type},${row.listing_id},${row.campaign_name || ''}`,
      ),
    ]
    downloadCsv(lines.join('\n'), `revenue-attribution-${startDate}-${endDate}.csv`)
  }, [data, endDate, startDate])

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-screen="AGN-REP-007" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
        <span className="sr-only">Loading revenue attribution</span>
      </div>
    )
  }

  if (!agent || loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-REP-007" dir={dir}>
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--lc-text-heading)]">Agency membership required</h1>
        <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
          Revenue attribution reports are available to active agency members.
        </p>
        <Link to="/agency" className="mt-4 inline-block">
          <Button>Go to agency dashboard</Button>
        </Link>
      </div>
    )
  }

  if (loadState === 'error' && !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-REP-007" dir={dir}>
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--lc-text-heading)]">Could not load report</h1>
        <Button className="mt-4 gap-2" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]" data-screen="AGN-REP-007" dir={dir}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              to="/agency/reports"
              className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Reports
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">Revenue attribution</h1>
            <p className="text-[var(--lc-text-muted)]">
              Closed-deal revenue by channel, agent, and campaign.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => void load({
              start_date: startDate,
              end_date: endDate,
              channel: channelFilter,
              agent_id: agentFilter,
              campaign_id: campaignFilter,
            })}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportReport} disabled={!data || isEmpty}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <CardDescription>Date range, channel, agent, and campaign narrow every chart below.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Channel</span>
              <select
                aria-label="Channel"
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              >
                <option value="">All channels</option>
                {(data?.filter_options.channels || []).map((channel) => (
                  <option key={channel} value={channel}>{channel.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Agent</span>
              <select
                aria-label="Agent"
                value={agentFilter}
                onChange={(event) => setAgentFilter(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              >
                <option value="">All agents</option>
                {(data?.filter_options.agents || []).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Campaign</span>
              <select
                aria-label="Campaign"
                value={campaignFilter}
                onChange={(event) => setCampaignFilter(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              >
                <option value="">All campaigns</option>
                {(data?.filter_options.campaigns || []).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
          </CardContent>
          <div className="border-t border-[var(--lc-border)] px-6 py-3">
            <Button
              size="sm"
              onClick={() => void load({
                start_date: startDate,
                end_date: endDate,
                channel: channelFilter,
                agent_id: agentFilter,
                campaign_id: campaignFilter,
              })}
            >
              Apply filters
            </Button>
          </div>
        </Card>

        {isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <TrendingDown className="h-10 w-10 text-[var(--lc-text-muted)]" />
              <p className="text-[var(--lc-text-muted)]">No closed transactions match the selected filters.</p>
              <Link to="/settings/historical-transactions" className="text-sm text-[var(--lc-text-brand)] hover:underline">
                Record historical transactions
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Total revenue" value={formatMoney(data?.summary.total_revenue || 0, currency)} />
              <MetricCard label="Closed deals" value={String(data?.summary.transaction_count || 0)} />
              <MetricCard label="Average deal" value={formatMoney(data?.summary.average_deal_value || 0, currency)} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue waterfall</CardTitle>
                  <CardDescription>Closed revenue by month.</CardDescription>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={(data?.waterfall || []).map((row) => ({ label: row.label, value: row.value }))}
                    emptyLabel="No monthly revenue"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By channel</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={(data?.by_channel || []).map((row) => ({ label: row.label, value: row.revenue }))}
                    emptyLabel="No channel breakdown"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By agent</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={(data?.by_agent || []).map((row) => ({ label: row.agent_name, value: row.revenue }))}
                    emptyLabel="No agent breakdown"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By campaign</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={(data?.by_campaign || []).map((row) => ({ label: row.campaign_name, value: row.revenue }))}
                    emptyLabel="No campaign breakdown"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transactions</CardTitle>
                <CardDescription>Per-deal drill-down for the selected filters.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--lc-border)] text-start text-[var(--lc-text-muted)]">
                      <th className="px-3 py-2 font-medium">Closed</th>
                      <th className="px-3 py-2 font-medium">Agent</th>
                      <th className="px-3 py-2 font-medium">Channel</th>
                      <th className="px-3 py-2 font-medium">Campaign</th>
                      <th className="px-3 py-2 font-medium">Revenue</th>
                      <th className="px-3 py-2 font-medium">Listing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.transactions || []).map((row) => (
                      <tr key={row.id} className="border-b border-[var(--lc-border)]">
                        <td className="px-3 py-2"><Numeric>{new Date(row.closed_at).toLocaleDateString()}</Numeric></td>
                        <td className="px-3 py-2">{row.agent_name}</td>
                        <td className="px-3 py-2 capitalize">{row.channel_label}</td>
                        <td className="px-3 py-2">{row.campaign_name || '—'}</td>
                        <td className="px-3 py-2"><Numeric>{formatMoney(row.final_sold_price, row.currency)}</Numeric></td>
                        <td className="px-3 py-2">
                          <Link to={`/listings/${row.listing_id}`} className="text-[var(--lc-text-brand)] hover:underline">
                            View listing
                          </Link>
                        </td>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-[var(--lc-text-muted)]">{label}</p>
        <p className="mt-1 text-2xl font-bold text-[var(--lc-text-heading)]">{value}</p>
      </CardContent>
    </Card>
  )
}
