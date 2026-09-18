/**
 * PA-AUD-002 — Audit-log retention policy.
 *
 * Configure how long the platform keeps each category of audit / activity data
 * before the retention purge (PA-AUD-001 → "Run retention") removes it. The
 * saved policy drives that purge job. Financial audit rows are held to a hard
 * 7-year regulatory floor; other categories are bounded.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, Save, ShieldCheck } from 'lucide-react'
import { api } from '@/api/client'
import type { AuditRetentionConstraints, AuditRetentionPolicy } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

type CategoryKey = 'financial_actions_days' | 'pa_actions_days' | 'tenant_actions_days' | 'system_events_days'

const CATEGORY_META: { key: CategoryKey; label: string; help: string }[] = [
  {
    key: 'financial_actions_days',
    label: 'Financial audit events',
    help: 'Invoices, payments, credit movements. Regulatory floor applies.',
  },
  { key: 'pa_actions_days', label: 'Platform-admin actions', help: 'Approvals, promotions, config changes.' },
  { key: 'tenant_actions_days', label: 'Tenant admin actions', help: 'Agency-side admin activity.' },
  { key: 'system_events_days', label: 'System events', help: 'Automated jobs, integrations, workers.' },
]

const DEFAULT_CONSTRAINTS: AuditRetentionConstraints = {
  financial_floor_days: 2555,
  min_category_days: 30,
  max_category_days: 3650,
}

function floorFor(key: CategoryKey, c: AuditRetentionConstraints) {
  return key === 'financial_actions_days' ? c.financial_floor_days : c.min_category_days
}

export function AuditRetentionPolicyPage() {
  const { addToast } = useToast()
  usePageTitle('Audit retention policy')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [constraints, setConstraints] = useState<AuditRetentionConstraints>(DEFAULT_CONSTRAINTS)
  const [meta, setMeta] = useState<{ updated_by: string | null; updated_at: string | null }>({
    updated_by: null,
    updated_at: null,
  })
  const [form, setForm] = useState<Record<CategoryKey, string>>({
    financial_actions_days: '',
    pa_actions_days: '',
    tenant_actions_days: '',
    system_events_days: '',
  })
  const [exportBeforePurge, setExportBeforePurge] = useState(true)

  const applyPolicy = useCallback((policy: AuditRetentionPolicy) => {
    setForm({
      financial_actions_days: String(policy.financial_actions_days),
      pa_actions_days: String(policy.pa_actions_days),
      tenant_actions_days: String(policy.tenant_actions_days),
      system_events_days: String(policy.system_events_days),
    })
    setExportBeforePurge(policy.export_before_purge)
    setMeta({ updated_by: policy.updated_by, updated_at: policy.updated_at })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getAuditRetentionPolicy()
      setConstraints(res.constraints)
      applyPolicy(res.policy)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load retention policy')
    } finally {
      setLoading(false)
    }
  }, [applyPolicy])

  useEffect(() => {
    void load()
  }, [load])

  const fieldErrors = useMemo(() => {
    const errs: Partial<Record<CategoryKey, string>> = {}
    for (const { key } of CATEGORY_META) {
      const raw = form[key]
      const n = Number(raw)
      const min = floorFor(key, constraints)
      if (raw === '' || !Number.isInteger(n)) {
        errs[key] = 'Enter a whole number of days'
      } else if (n < min) {
        errs[key] = `Minimum ${min} days`
      } else if (n > constraints.max_category_days) {
        errs[key] = `Maximum ${constraints.max_category_days} days`
      }
    }
    return errs
  }, [form, constraints])

  const hasErrors = Object.keys(fieldErrors).length > 0

  async function handleSave() {
    if (saving || hasErrors) return
    setSaving(true)
    try {
      const { policy } = await api.updateAuditRetentionPolicy({
        financial_actions_days: Number(form.financial_actions_days),
        pa_actions_days: Number(form.pa_actions_days),
        tenant_actions_days: Number(form.tenant_actions_days),
        system_events_days: Number(form.system_events_days),
        export_before_purge: exportBeforePurge,
      })
      applyPolicy(policy)
      addToast({ title: 'Retention policy saved', variant: 'success' })
    } catch (err: unknown) {
      addToast({
        title: 'Could not save policy',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6" data-testid="retention-policy-page">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/audit">
            <ArrowLeft className="me-1 h-4 w-4" />
            Audit log
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-[var(--lc-text-primary)]">Retention policy</h1>
          <p className="mt-0.5 text-sm text-[var(--lc-text-muted)]">
            How long each category of audit data is kept before the retention purge removes it.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16" data-testid="retention-loading">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" />
        </div>
      ) : error ? (
        <div data-testid="retention-error">
          <div
            role="alert"
            className="rounded-md border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]"
          >
            {error}
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-[var(--lc-action-primary)]" />
                Retention windows
              </CardTitle>
              <CardDescription>
                Days to keep each category. Financial audit rows are held to a{' '}
                <Numeric>{constraints.financial_floor_days}</Numeric>-day (7-year) regulatory floor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {CATEGORY_META.map(({ key, label, help }) => (
                <div key={key} className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`ret-${key}`} className="text-sm text-[var(--lc-text-primary)]">
                      {label}
                    </Label>
                    <p className="text-xs text-[var(--lc-text-muted)]">{help}</p>
                    <p className="text-xs text-[var(--lc-text-muted)]">
                      Range <Numeric>{floorFor(key, constraints)}</Numeric>–
                      <Numeric>{constraints.max_category_days}</Numeric> days
                    </p>
                  </div>
                  <div className="w-32">
                    <div className="flex items-center gap-1.5">
                      <Input
                        id={`ret-${key}`}
                        type="number"
                        inputMode="numeric"
                        min={floorFor(key, constraints)}
                        max={constraints.max_category_days}
                        value={form[key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="lc-data text-end"
                        aria-label={`${label} retention days`}
                        aria-invalid={Boolean(fieldErrors[key])}
                      />
                      <span className="text-xs text-[var(--lc-text-muted)]">days</span>
                    </div>
                    {fieldErrors[key] && (
                      <p className="mt-1 text-xs text-[var(--lc-status-danger-fg)]">{fieldErrors[key]}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--lc-text-primary)]">Export before purge</div>
                <p className="text-xs text-[var(--lc-text-muted)]">
                  Write a data export of rows about to be deleted before the purge runs.
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--lc-text-muted)]">
                <input
                  type="checkbox"
                  checked={exportBeforePurge}
                  onChange={(e) => setExportBeforePurge(e.target.checked)}
                  data-testid="retention-export-toggle"
                />
                Enabled
              </label>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-xs text-[var(--lc-text-muted)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Lowering a window purges older rows on the next retention run. This cannot be undone.
          </div>

          <div className="flex items-center justify-between gap-3 pb-8">
            <p className="text-xs text-[var(--lc-text-muted)]">
              {meta.updated_at
                ? `Last updated ${new Date(meta.updated_at).toLocaleString()}`
                : 'Using platform defaults'}
            </p>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || hasErrors}
              className="gap-2 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
              data-testid="retention-save"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save policy
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default AuditRetentionPolicyPage
