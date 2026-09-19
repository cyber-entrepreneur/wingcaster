/**
 * AGN-REP-002 — Agency listings performance report.
 *
 * Aggregate performance across all agency listings with filters, KPIs,
 * table + chart, and CSV export.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  TrendingDown,
} from 'lucide-react'
import { api, type AgencyListingsPerformanceResponse } from '@/api/client'
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

function formatPercent(value: number | null | undefined) {
  return value == null ? '—' : `${value}%`
}

export function AgencyListingsPerformanceReportPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Listings performance')

  const defaults = useMemo(() => defaultDateRange(), [])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AgencyListingsPerformanceResponse | null>(null)
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [agentFilter, setAgentFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('')

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const load = useCallback(async (filters?: {
    start_date?: string
    end_date?: string
    agent_id?: string
    area?: string
    property_type?: string
  }) => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const response = await api.getAgencyListingsPerformance({
        start_date: filters?.start_date ?? startDate,
        end_date: filters?.end_date ?? endDate,
        agent_id: filters?.agent_id ?? (agentFilter || undefined),
        area: filters?.area ?? (areaFilter || undefined),
        property_type: filters?.property_type ?? (propertyTypeFilter || undefined),
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
        title: 'Listings report unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }, [addToast, agentFilter, areaFilter, endDate, hasAgency, propertyTypeFilter, startDate])

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
      'id,title,city,neighborhood,property_type,status,agent_name,views,saves,inquiries,viewings,conversions,conversion_rate',
      ...data.rows.map((row) =>
        [
          row.id,
          `"${row.title.replace(/"/g, '""')}"`,
          row.city || '',
          row.neighborhood || '',
          row.property_type || '',
          row.status,
          row.agent_name || '',
          row.views,
          row.saves,
          row.inquiries,
          row.viewings,
          row.conversions,
          row.conversion_rate ?? '',
        ].join(','),
      ),
    ]
    downloadCsv(lines.join('\n'), 'agency-listings-performance.csv')
  }, [data])

  if (authLoading || loadState === 'loading') {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center bg-[var(--lc-bg-page)]"
        data-screen="AGN-REP-002"
        dir={dir}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-hidden="true" />
        <span className="sr-only">Loading listings performance</span>
      </div>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center" data-screen="AGN-REP-002" dir={dir}>
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-warning-fg)]" />
        <h1 className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-title)' }}>
          Listings report unavailable
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          You need an active agency membership to view agency-wide listing performance.
        </p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center" data-screen="AGN-REP-002" dir={dir}>
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-unpublished-fg)]" />
        <h1 className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-title)' }}>
          Could not load listings report
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
    <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-REP-002" dir={dir}>
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
              Listings performance
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--lc-text-muted)]">
              Aggregate views, saves, inquiries, viewings, and conversions across all agency listings.
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
            <CardDescription>Refine by date range, agent, area, and property type.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <span className="text-[var(--lc-text-muted)]">Agent</span>
              <select
                value={agentFilter}
                onChange={(event) => setAgentFilter(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              >
                <option value="">All agents</option>
                {(data?.filter_options.agents || []).map((agentOption) => (
                  <option key={agentOption.id} value={agentOption.id}>{agentOption.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Area</span>
              <select
                value={areaFilter}
                onChange={(event) => setAreaFilter(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              >
                <option value="">All areas</option>
                {(data?.filter_options.areas || []).map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-4">
              <span className="text-[var(--lc-text-muted)]">Property type</span>
              <select
                value={propertyTypeFilter}
                onChange={(event) => setPropertyTypeFilter(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 sm:max-w-xs"
              >
                <option value="">All property types</option>
                {(data?.filter_options.property_types || []).map((type) => (
                  <option key={type} value={type}>{type}</option>
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
                agent_id: agentFilter,
                area: areaFilter,
                property_type: propertyTypeFilter,
              })}
            >
              Apply filters
            </Button>
          </div>
        </Card>

        {loadState === 'empty' ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <TrendingDown className="h-10 w-10 text-[var(--lc-text-muted)]" />
              <p className="text-[var(--lc-text-muted)]">No listings match the selected filters.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <MetricCard label="Listings" value={overview?.listings || 0} />
              <MetricCard label="Views" value={overview?.total_views || 0} />
              <MetricCard label="Saves" value={overview?.total_saves || 0} />
              <MetricCard label="Inquiries" value={overview?.total_inquiries || 0} />
              <MetricCard label="Viewings" value={overview?.total_viewings || 0} />
              <MetricCard
                label="Conversions"
                value={overview?.total_conversions || 0}
                sub={formatPercent(overview?.conversion_rate)}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top listings by views</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={(data?.top_listings || []).map((row) => ({
                      id: row.id,
                      label: row.title,
                      value: row.views,
                    }))}
                    emptyLabel="No listing views in range"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Traffic by channel</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={(data?.by_channel || []).map((row) => ({ label: row.label, value: row.value }))}
                    emptyLabel="No channel data in range"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">All listings</CardTitle>
                <CardDescription>Drill into a listing from the agent listings workspace.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--lc-border)] text-start text-[var(--lc-text-muted)]">
                      <th className="px-3 py-2 font-medium">Listing</th>
                      <th className="px-3 py-2 font-medium">Agent</th>
                      <th className="px-3 py-2 font-medium">Area</th>
                      <th className="px-3 py-2 font-medium">Views</th>
                      <th className="px-3 py-2 font-medium">Saves</th>
                      <th className="px-3 py-2 font-medium">Inquiries</th>
                      <th className="px-3 py-2 font-medium">Viewings</th>
                      <th className="px-3 py-2 font-medium">Conversions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.rows || []).map((row) => (
                      <tr key={row.id} className="border-b border-[var(--lc-border)]">
                        <td className="px-3 py-3">
                          <Link
                            to={`/listings/${row.id}`}
                            className="font-medium text-[var(--lc-text-heading)] hover:underline"
                          >
                            {row.title}
                          </Link>
                          <p className="text-xs text-[var(--lc-text-muted)]">{row.property_type || '—'}</p>
                        </td>
                        <td className="px-3 py-3">{row.agent_name || '—'}</td>
                        <td className="px-3 py-3">{row.neighborhood || row.city || '—'}</td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.views)}</Numeric></td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.saves)}</Numeric></td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.inquiries)}</Numeric></td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.viewings)}</Numeric></td>
                        <td className="px-3 py-3"><Numeric>{formatStat(row.conversions)}</Numeric></td>
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

function MetricCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-[var(--lc-text-muted)]">{label}</p>
        <p className="mt-1 text-3xl font-bold text-[var(--lc-text-heading)]">
          <Numeric>{formatStat(value)}</Numeric>
        </p>
        {sub ? <p className="mt-1 text-xs text-[var(--lc-text-muted)]">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}
