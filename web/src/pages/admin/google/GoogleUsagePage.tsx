/**
 * PA-GOO-001 — Google Maps usage & budget dashboard.
 *
 * Cost governance for the Google Maps spend that powers area intelligence:
 * month-to-date spend vs a configurable budget, projected month-end, headroom,
 * per-operation and per-area breakdowns, and a daily trend. A Platform Admin
 * can edit the monthly budget + alert threshold, which drive the over-budget /
 * near-threshold banners. Over-budget triggers a site-wide static-maps fallback.
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, DollarSign, Loader2, Save, TrendingUp } from 'lucide-react'
import { api } from '@/api/client'
import type { GoogleBudgetConfig, GoogleUsageSummary } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

function usd(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

export function GoogleUsagePage() {
  const { addToast } = useToast()
  usePageTitle('Google Maps usage')

  const [summary, setSummary] = useState<GoogleUsageSummary | null>(null)
  const [budget, setBudget] = useState<GoogleBudgetConfig | null>(null)
  const [maxBudget, setMaxBudget] = useState(10000000)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [budgetInput, setBudgetInput] = useState('')
  const [thresholdInput, setThresholdInput] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryRes, budgetRes] = await Promise.all([api.getGoogleUsageSummary({ days: 30 }), api.getGoogleBudget()])
      setSummary(summaryRes.summary)
      setBudget(budgetRes.config)
      setMaxBudget(budgetRes.constraints.max_budget_usd_monthly)
      setBudgetInput(String(budgetRes.config.budget_usd_monthly))
      setThresholdInput(String(budgetRes.config.alert_threshold_pct))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Google usage')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const budgetNum = Number(budgetInput)
  const thresholdNum = Number(thresholdInput)
  const budgetValid = Number.isFinite(budgetNum) && budgetNum >= 0 && budgetNum <= maxBudget
  const thresholdValid = Number.isInteger(thresholdNum) && thresholdNum >= 1 && thresholdNum <= 100
  const canSave = budgetValid && thresholdValid && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await api.updateGoogleBudget({ budget_usd_monthly: budgetNum, alert_threshold_pct: thresholdNum })
      addToast({ title: 'Budget updated', variant: 'success' })
      await load()
    } catch (err: unknown) {
      addToast({
        title: 'Could not update budget',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="google-usage-loading">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" />
      </div>
    )
  }

  if (error || !summary || !budget) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10" data-testid="google-usage-error">
        <div
          role="alert"
          className="rounded-md border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]"
        >
          {error || 'No usage data available.'}
        </div>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  const maxDailyCost = Math.max(0, ...summary.daily.map((d) => d.cost))
  const pctForBar = Math.min(100, summary.pct_consumed)

  const kpis = [
    { label: 'MTD spend', value: usd(summary.mtd_spend_usd) },
    { label: 'Monthly budget', value: usd(summary.budget_usd_monthly) },
    { label: 'Headroom', value: usd(summary.headroom_usd) },
    { label: 'Projected month-end', value: usd(summary.projected_month_end_usd) },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6" data-testid="google-usage-page">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--lc-text-primary)]">
          <TrendingUp className="h-5 w-5 text-[var(--lc-action-primary)]" />
          Google Maps usage
        </h1>
        <p className="mt-0.5 text-sm text-[var(--lc-text-muted)]">
          Month-to-date spend and budget for the Google Maps APIs that power area intelligence.
        </p>
      </div>

      {summary.over_budget ? (
        <div
          role="alert"
          data-testid="google-usage-over-budget"
          className="flex items-center gap-2 rounded-md border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Over budget this month. Google Maps calls fall back to static maps site-wide until spend resets.
        </div>
      ) : summary.near_threshold ? (
        <div
          role="status"
          data-testid="google-usage-near-threshold"
          className="flex items-center gap-2 rounded-md border border-[var(--lc-status-warning-fg)] bg-[var(--lc-status-warning-bg)] px-3 py-2 text-sm text-[var(--lc-status-warning-fg)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Spend has crossed the alert threshold (<Numeric>{summary.alert_threshold_pct}</Numeric>%).
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-[var(--lc-text-muted)]">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Numeric className="text-lg font-semibold text-[var(--lc-text-primary)]">{kpi.value}</Numeric>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[var(--lc-text-primary)]">
            Budget consumed — <Numeric>{summary.pct_consumed}</Numeric>%
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--lc-surface-sunken)]">
            <div
              data-testid="google-usage-progress"
              className={`h-full rounded-full ${summary.over_budget ? 'bg-[var(--lc-status-danger-fg)]' : 'bg-[var(--lc-action-primary)]'}`}
              style={{ inlineSize: `${pctForBar}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--lc-text-muted)]">
            <Numeric>{usd(summary.mtd_spend_usd)}</Numeric> of <Numeric>{usd(summary.budget_usd_monthly)}</Numeric> ·{' '}
            <Numeric>{summary.mtd_requests}</Numeric> requests MTD
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By operation</CardTitle>
            <CardDescription>Month-to-date cost per API operation.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.by_operation.length === 0 ? (
              <p className="text-sm text-[var(--lc-text-muted)]" data-testid="google-usage-ops-empty">
                No usage recorded this month.
              </p>
            ) : (
              <ul className="space-y-1.5" data-testid="google-usage-ops">
                {summary.by_operation.map((op) => (
                  <li key={op.operation} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-[var(--lc-text-primary)]">{op.operation}</span>
                    <span className="flex shrink-0 items-center gap-3 text-[var(--lc-text-muted)]">
                      <Numeric>{op.requests}</Numeric>
                      <Numeric className="text-[var(--lc-text-primary)]">{usd(op.cost)}</Numeric>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top consumers</CardTitle>
            <CardDescription>Areas with the highest spend this month.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.top_consumers.length === 0 ? (
              <p className="text-sm text-[var(--lc-text-muted)]" data-testid="google-usage-consumers-empty">
                No attributed spend this month.
              </p>
            ) : (
              <ul className="space-y-1.5" data-testid="google-usage-consumers">
                {summary.top_consumers.map((c) => (
                  <li key={c.area_id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-[var(--lc-text-primary)]">{c.area_id}</span>
                    <Numeric className="shrink-0 text-[var(--lc-text-primary)]">{usd(c.cost)}</Numeric>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily spend (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1" data-testid="google-usage-daily">
            {summary.daily.map((d) => (
              <li key={d.date} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-[var(--lc-text-muted)]">{d.date.slice(5)}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--lc-surface-sunken)]">
                  <div
                    className="h-full rounded-full bg-[var(--lc-action-primary)]"
                    style={{ inlineSize: maxDailyCost > 0 ? `${(d.cost / maxDailyCost) * 100}%` : '0%' }}
                  />
                </div>
                <Numeric className="w-16 shrink-0 text-end text-[var(--lc-text-muted)]">{usd(d.cost)}</Numeric>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-[var(--lc-action-primary)]" />
            Budget &amp; alerts
          </CardTitle>
          <CardDescription>Set the monthly budget and the alert threshold that trips the warning banner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="google-budget" className="text-xs">
                Monthly budget (USD)
              </Label>
              <Input
                id="google-budget"
                type="number"
                inputMode="decimal"
                min={0}
                max={maxBudget}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="lc-data mt-1 w-40 text-end"
                aria-invalid={!budgetValid}
              />
              {!budgetValid && <p className="mt-1 text-xs text-[var(--lc-status-danger-fg)]">Enter 0–{maxBudget}</p>}
            </div>
            <div>
              <Label htmlFor="google-threshold" className="text-xs">
                Alert threshold (%)
              </Label>
              <Input
                id="google-threshold"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="lc-data mt-1 w-32 text-end"
                aria-invalid={!thresholdValid}
              />
              {!thresholdValid && <p className="mt-1 text-xs text-[var(--lc-status-danger-fg)]">1–100</p>}
            </div>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className="gap-2 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
              data-testid="google-budget-save"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
          <p className="text-xs text-[var(--lc-text-muted)]">
            {budget.updated_at ? `Last updated ${new Date(budget.updated_at).toLocaleString()}` : 'Using platform default'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default GoogleUsagePage
