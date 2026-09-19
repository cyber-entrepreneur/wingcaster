/**
 * AGN-REP-003 — Lead conversion funnel (agency reports).
 *
 * Funnel from inquiry → viewing → opportunity → closed, with source/agent
 * segmentation, conversion rates, Sankey-style flow, and CSV export.
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
import { api, type AgencyLeadFunnelResponse } from '@/api/client'
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

function formatPercent(value: number | null | undefined) {
  return value == null ? '—' : `${value}%`
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

function FunnelSankeyPanel({ data }: { data: AgencyLeadFunnelResponse['sankey'] }) {
  const sourceNodes = data.nodes.filter((node) => node.group === 'source')
  const agentNodes = data.nodes.filter((node) => node.group === 'agent')
  const outcomeNodes = data.nodes.filter((node) => node.group === 'outcome')

  if (!data.links.length) {
    return <p className="py-6 text-center text-sm text-[var(--lc-text-muted)]">No flow data for the selected filters.</p>
  }

  const linkValue = (sourceId: string, targetId: string) =>
    data.links.find((link) => link.source === sourceId && link.target === targetId)?.value || 0

  return (
    <div className="space-y-4 overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-3 gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--lc-text-muted)]">Source</p>
          <div className="space-y-2">
            {sourceNodes.map((node) => (
              <div key={node.id} className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-sm">
                <span className="font-medium">{node.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--lc-text-muted)]">Agent</p>
          <div className="space-y-2">
            {agentNodes.map((node) => (
              <div key={node.id} className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm">
                <span className="font-medium">{node.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--lc-text-muted)]">Outcome</p>
          <div className="space-y-2">
            {outcomeNodes.map((node) => (
              <div key={node.id} className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-3 py-2 text-sm">
                <span className="font-medium capitalize">{node.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-[640px] space-y-2 text-xs text-[var(--lc-text-muted)]">
        {sourceNodes.flatMap((source) =>
          agentNodes.map((agent) => {
            const value = linkValue(source.id, agent.id)
            if (!value) return null
            return (
              <p key={`${source.id}-${agent.id}`}>
                {source.label} → {agent.label}: <Numeric>{value}</Numeric>
              </p>
            )
          }),
        )}
        {agentNodes.flatMap((agent) =>
          outcomeNodes.map((outcome) => {
            const value = linkValue(agent.id, outcome.id)
            if (!value) return null
            return (
              <p key={`${agent.id}-${outcome.id}`}>
                {agent.label} → {outcome.label}: <Numeric>{value}</Numeric>
              </p>
            )
          }),
        )}
      </div>
    </div>
  )
}

export function LeadConversionFunnelPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Lead conversion funnel')

  const defaults = useMemo(() => defaultDateRange(), [])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AgencyLeadFunnelResponse | null>(null)
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [sourceFilter, setSourceFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')

  const affiliation = (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const load = useCallback(async (filters?: {
    start_date?: string
    end_date?: string
    source?: string
    agent_id?: string
    area?: string
  }) => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const response = await api.getAgencyLeadFunnel({
        start_date: filters?.start_date ?? startDate,
        end_date: filters?.end_date ?? endDate,
        source: filters?.source ?? (sourceFilter || undefined),
        agent_id: filters?.agent_id ?? (agentFilter || undefined),
        area: filters?.area ?? (areaFilter || undefined),
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
        title: 'Lead funnel unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }, [addToast, agentFilter, areaFilter, endDate, hasAgency, sourceFilter, startDate])

  useEffect(() => {
    if (authLoading || !hasAgency) return
    void load()
    // Initial fetch only — filter changes apply via the Apply filters button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, hasAgency])

  const stageItems = useMemo(
    () => (data?.by_stage || []).map((row) => ({ label: row.stage.replace(/_/g, ' '), value: row.count })),
    [data],
  )

  const exportReport = useCallback(() => {
    if (!data) return
    const lines = [
      'stage,count',
      ...data.by_stage.map((row) => `${row.stage},${row.count}`),
      '',
      'source,inquiries,viewings,opportunities,won,won_value',
      ...data.by_source.map(
        (row) => `${row.source},${row.inquiries},${row.viewings},${row.opportunities},${row.won},${row.won_value}`,
      ),
      '',
      'agent,inquiries,viewings,opportunities,won',
      ...data.by_agent.map(
        (row) => `${row.agent_name},${row.inquiries},${row.viewings},${row.opportunities},${row.won}`,
      ),
    ]
    downloadCsv(lines.join('\n'), `lead-funnel-${startDate}-${endDate}.csv`)
  }, [data, endDate, startDate])

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-screen="AGN-REP-003" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
        <span className="sr-only">Loading lead funnel</span>
      </div>
    )
  }

  if (!agent || loadState === 'forbidden') {
    return (
      <div
        className="mx-auto max-w-md px-4 py-16 text-center"
        data-screen="AGN-REP-003"
        dir={dir}
      >
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--lc-text-heading)]">Agency membership required</h1>
        <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
          Lead conversion reports are available to active agency members.
        </p>
        <Link to="/agency" className="mt-4 inline-block">
          <Button>Go to agency dashboard</Button>
        </Link>
      </div>
    )
  }

  if (loadState === 'error' && !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-REP-003" dir={dir}>
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--lc-text-heading)]">Could not load funnel</h1>
        <Button className="mt-4 gap-2" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const funnel = data?.funnel
  const rates = data?.conversion_rates
  const isEmpty = !funnel?.inquiries

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]" data-screen="AGN-REP-003" dir={dir}>
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
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">Lead conversion funnel</h1>
            <p className="text-[var(--lc-text-muted)]">
              Inquiry → viewing → opportunity → closed, segmented by source and agent.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => void load({
              start_date: startDate,
              end_date: endDate,
              source: sourceFilter,
              agent_id: agentFilter,
              area: areaFilter,
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
            <CardDescription>Date range, source, agent, and area narrow every chart below.</CardDescription>
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
              <span className="text-[var(--lc-text-muted)]">Source</span>
              <select
                aria-label="Source"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2"
              >
                <option value="">All sources</option>
                {(data?.filter_options.sources || []).map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--lc-text-muted)]">Agent</span>
              <select
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
          </CardContent>
          <div className="border-t border-[var(--lc-border)] px-6 py-3">
            <Button
              size="sm"
              onClick={() => void load({
                start_date: startDate,
                end_date: endDate,
                source: sourceFilter,
                agent_id: agentFilter,
                area: areaFilter,
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
              <p className="text-[var(--lc-text-muted)]">No inquiries match the selected filters.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Inquiries" value={funnel?.inquiries || 0} />
              <MetricCard label="Viewings" value={funnel?.viewings || 0} sub={formatPercent(rates?.inquiry_to_viewing)} />
              <MetricCard label="Opportunities" value={funnel?.opportunities || 0} sub={formatPercent(rates?.viewing_to_opportunity)} />
              <MetricCard label="Won" value={funnel?.closed_won || 0} sub={formatPercent(rates?.opportunity_to_won)} />
              <MetricCard label="Lost" value={funnel?.closed_lost || 0} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Funnel stages</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart items={stageItems} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By source</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={(data?.by_source || []).map((row) => ({ label: row.source, value: row.inquiries }))}
                    emptyLabel="No source breakdown"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By agent</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={(data?.by_agent || []).map((row) => ({ label: row.agent_name, value: row.inquiries }))}
                    emptyLabel="No agent breakdown"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Source → agent → outcome</CardTitle>
                  <CardDescription>Sankey-style flow across attribution and close outcomes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FunnelSankeyPanel data={data?.sankey || { nodes: [], links: [] }} />
                </CardContent>
              </Card>
            </div>
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
          <Numeric>{value}</Numeric>
        </p>
        {sub && <p className="mt-1 text-xs text-[var(--lc-text-muted)]">{sub} conversion</p>}
      </CardContent>
    </Card>
  )
}
