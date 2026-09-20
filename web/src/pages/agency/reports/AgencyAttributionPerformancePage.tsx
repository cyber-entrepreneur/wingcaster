/**
 * Growth-OS Wave 2C — Attribution & commission performance.
 * Funnel → GTV → commission → ROAS with attribution-model switcher.
 * data-screen="AGN-REP-ATTR" (Growth-OS attribution; complements AGN-REP-006/007).
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  GitBranch,
  Loader2,
  RefreshCw,
  Target,
} from 'lucide-react'
import {
  api,
  type AgencyAttributionChainResponse,
  type AgencyAttributionPerformanceResponse,
  type AttributionModel,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden' | 'empty'

const MODELS: Array<{ id: AttributionModel; label: string }> = [
  { id: 'last', label: 'Last touch' },
  { id: 'first', label: 'First touch' },
  { id: 'linear', label: 'Linear' },
  { id: 'position', label: 'Position' },
  { id: 'data_driven', label: 'Data-driven' },
]

function microsToMajor(micros: number | null | undefined) {
  if (micros == null) return null
  return micros / 1_000_000
}

function formatMoney(micros: number | null | undefined, currency = 'USD') {
  const major = microsToMajor(micros)
  if (major == null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(major)
}

function formatRatio(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export function AgencyAttributionPerformancePage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Attribution & commission')

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AgencyAttributionPerformanceResponse | null>(null)
  const [model, setModel] = useState<AttributionModel>('last')
  const [selectedConversionId, setSelectedConversionId] = useState<string | null>(null)
  const [chain, setChain] = useState<AgencyAttributionChainResponse | null>(null)
  const [chainLoading, setChainLoading] = useState(false)

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const load = useCallback(async (nextModel?: AttributionModel) => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    const activeModel = nextModel ?? model
    setLoadState('loading')
    try {
      const response = await api.getAgencyAttributionPerformance({ model: activeModel })
      setData(response)
      if (response.code === 'NOT_CONFIGURED') {
        setLoadState('ready')
        return
      }
      const hasRows =
        (response.by_execution?.length || 0) > 0 ||
        (response.by_campaign?.length || 0) > 0 ||
        (response.conversions?.length || 0) > 0
      setLoadState(hasRows ? 'ready' : 'empty')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({
        title: 'Attribution report unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }, [addToast, hasAgency, model])

  const loadChain = useCallback(async (conversionId: string, activeModel: AttributionModel) => {
    setChainLoading(true)
    setSelectedConversionId(conversionId)
    try {
      const response = await api.getAgencyAttributionChain(conversionId, { model: activeModel })
      setChain(response)
    } catch (err) {
      addToast({
        title: 'Attribution chain unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
      setChain(null)
    } finally {
      setChainLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (authLoading) return
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, hasAgency])

  const onModelChange = (next: AttributionModel) => {
    setModel(next)
    setChain(null)
    setSelectedConversionId(null)
    void load(next)
  }

  if (authLoading || loadState === 'loading') {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center bg-[var(--lc-bg-page)]"
        data-screen="AGN-REP-ATTR"
        dir={dir}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-hidden="true" />
        <span className="sr-only">Loading attribution performance</span>
      </div>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center" data-screen="AGN-REP-ATTR" dir={dir}>
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-[var(--lc-warning)]" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-[var(--lc-text-heading)]">Agency access required</h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          Attribution and commission reports are available to active agency members.
        </p>
        <Button asChild className="mt-6" variant="secondary">
          <Link to="/agency/reports">Back to reports</Link>
        </Button>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center" data-screen="AGN-REP-ATTR" dir={dir}>
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-[var(--lc-danger)]" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-[var(--lc-text-heading)]">Could not load attribution</h1>
        <Button className="mt-6" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  const overview = data?.overview
  const currency = overview?.currency || 'USD'
  const notConfigured = data?.code === 'NOT_CONFIGURED'

  return (
    <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-REP-ATTR" dir={dir}>
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
              <Target className="h-8 w-8" aria-hidden="true" />
              Attribution &amp; commission
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--lc-text-muted)]">
              Which marketing produced property revenue — funnel through commission, with ROAS by attribution model.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>

        <div
          role="tablist"
          aria-label="Attribution model"
          className="flex flex-wrap gap-2"
        >
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={model === m.id}
              onClick={() => onModelChange(m.id)}
              className={
                model === m.id
                  ? 'rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] px-3 py-2 text-sm font-medium text-[var(--lc-text-heading)]'
                  : 'rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]'
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        {notConfigured ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-[var(--lc-text-heading)] font-medium">Data-driven model is not configured</p>
              <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
                Switch to last, first, linear, or position. No credits are invented for data-driven.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!notConfigured && overview ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Leads', value: overview.leads },
              { label: 'Qualified', value: overview.qualified },
              { label: 'Viewings', value: overview.viewings },
              { label: 'Offers', value: overview.offers },
              { label: 'Reservations', value: overview.reservations },
              { label: 'Transactions', value: overview.transactions },
              { label: 'GTV', value: formatMoney(overview.gtv_micros, currency) },
              { label: 'Commission', value: formatMoney(overview.commission_micros, currency) },
              { label: 'Marketing cost', value: formatMoney(overview.marketing_cost_micros, currency) },
              { label: 'ROAS', value: overview.roas == null ? '—' : overview.roas.toFixed(2) + 'x' },
              { label: 'ROI', value: formatRatio(overview.roi) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-[var(--lc-text-muted)]">{stat.label}</p>
                <p className="mt-1 text-xl font-semibold text-[var(--lc-text-heading)]">
                  {typeof stat.value === 'number' ? <Numeric>{stat.value}</Numeric> : stat.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {loadState === 'empty' && !notConfigured ? (
          <Card>
            <CardContent className="py-16 text-center text-[var(--lc-text-muted)]">
              No attributed conversions yet for this model.
            </CardContent>
          </Card>
        ) : null}

        {!notConfigured && (data?.by_execution?.length || 0) > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-execution attribution</CardTitle>
              <CardDescription>
                Credits keyed by execution_id — standalone executions (no campaign) still appear here.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-start text-sm">
                <thead>
                  <tr className="border-b border-[var(--lc-border)] text-[var(--lc-text-muted)]">
                    <th className="px-3 py-2 font-medium">Execution</th>
                    <th className="px-3 py-2 font-medium">Campaign</th>
                    <th className="px-3 py-2 font-medium">Leads</th>
                    <th className="px-3 py-2 font-medium">Commission</th>
                    <th className="px-3 py-2 font-medium">Cost</th>
                    <th className="px-3 py-2 font-medium">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.by_execution.map((row) => (
                    <tr key={row.execution_id} className="border-b border-[var(--lc-border)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--lc-text-primary)]">
                        {row.execution_id}
                      </td>
                      <td className="px-3 py-2 text-[var(--lc-text-muted)]">
                        {row.campaign_id || '— standalone'}
                      </td>
                      <td className="px-3 py-2"><Numeric>{row.leads}</Numeric></td>
                      <td className="px-3 py-2">{formatMoney(row.commission_micros, currency)}</td>
                      <td className="px-3 py-2">{formatMoney(row.marketing_cost_micros, currency)}</td>
                      <td className="px-3 py-2">
                        {row.roas == null ? '—' : `${row.roas.toFixed(2)}x`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}

        {!notConfigured && (data?.conversions?.length || 0) > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                Conversion drill-down
              </CardTitle>
              <CardDescription>Open the causal touchpoint chain for a conversion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-y divide-[var(--lc-border)]">
                {data?.conversions.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[var(--lc-text-heading)]">
                        {c.from_stage || '∅'} → {c.to_stage}
                      </p>
                      <p className="text-xs text-[var(--lc-text-muted)] font-mono">{c.id}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedConversionId === c.id ? 'default' : 'secondary'}
                      onClick={() => void loadChain(c.id, model)}
                    >
                      View chain
                    </Button>
                  </li>
                ))}
              </ul>

              {chainLoading ? (
                <div className="flex items-center gap-2 text-[var(--lc-text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading chain…
                </div>
              ) : null}

              {chain && !chainLoading ? (
                <div className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
                  {chain.code === 'NOT_CONFIGURED' ? (
                    <p className="text-sm text-[var(--lc-text-muted)]">
                      Data-driven model is not configured for this chain.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-[var(--lc-text-muted)] mb-3">
                        Touchpoints ({chain.touchpoint_execution_ids.length}) under{' '}
                        <strong className="text-[var(--lc-text-heading)]">{chain.model}</strong>
                      </p>
                      <ol className="space-y-2">
                        {chain.executions.map((exec, idx) => {
                          const credit = chain.credits.find((c) => c.execution_id === exec.id)
                          return (
                            <li
                              key={exec.id}
                              className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                            >
                              <span className="font-mono text-xs text-[var(--lc-text-primary)]">
                                {idx + 1}. {exec.id}
                                {exec.campaign_id
                                  ? ` · campaign ${exec.campaign_id}`
                                  : ' · standalone'}
                              </span>
                              <span className="text-[var(--lc-text-muted)]">
                                credit{' '}
                                {credit
                                  ? `${(Number(credit.credit_weight) * 100).toFixed(1)}%`
                                  : '—'}
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    </>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
