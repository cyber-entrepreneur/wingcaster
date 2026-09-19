import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Play, Save } from 'lucide-react'
import {
  api,
  type CustomReportCatalogResponse,
  type CustomReportDefinition,
  type CustomReportRunResponse,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

const EMPTY_DEFINITION: CustomReportDefinition = {
  metrics: [],
  dimensions: [],
  filters: {},
}

export function AgencyCustomReportBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle(isNew ? 'New custom report' : 'Custom report')

  const affiliation = (agent?.affiliation as { role?: string } | undefined) || undefined
  const role = affiliation?.role || null
  const canAttemptLoad = Boolean(role === 'owner' || role === 'admin' || role === 'member')

  const [catalog, setCatalog] = useState<CustomReportCatalogResponse | null>(null)
  const [name, setName] = useState('Untitled report')
  const [definition, setDefinition] = useState<CustomReportDefinition>(EMPTY_DEFINITION)
  const [canManage, setCanManage] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>(canAttemptLoad ? 'loading' : 'forbidden')
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<CustomReportRunResponse | null>(null)

  const metricLabelByKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const metric of catalog?.metrics || []) map.set(metric.key, metric.label)
    return map
  }, [catalog?.metrics])

  const load = useCallback(async () => {
    if (!canAttemptLoad) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const catalogResponse = await api.getAgencyCustomReportCatalog()
      setCatalog(catalogResponse)
      if (!isNew && id) {
        const { report, permissions } = await api.getAgencyCustomReport(id)
        setName(report.name)
        setDefinition(report.definition)
        setCanManage(permissions.can_manage)
      } else {
        setCanManage(role === 'owner' || role === 'admin')
      }
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) setLoadState('forbidden')
      else setLoadState('error')
    }
  }, [canAttemptLoad, id, isNew, role])

  useEffect(() => {
    void load()
  }, [load])

  const toggleMetric = (key: string) => {
    setDefinition((current) => {
      const metrics = current.metrics.includes(key)
        ? current.metrics.filter((item) => item !== key)
        : [...current.metrics, key]
      return { ...current, metrics }
    })
  }

  const toggleDimension = (key: string) => {
    setDefinition((current) => {
      const dimensions = current.dimensions.includes(key)
        ? current.dimensions.filter((item) => item !== key)
        : [...current.dimensions, key]
      return { ...current, dimensions }
    })
  }

  const updateFilter = (key: keyof CustomReportDefinition['filters'], value: string) => {
    setDefinition((current) => ({
      ...current,
      filters: {
        ...current.filters,
        [key]: value || null,
      },
    }))
  }

  const runReport = async () => {
    if (!definition.metrics.length) {
      addToast({ title: 'Select at least one metric', variant: 'error' })
      return
    }
    setRunning(true)
    try {
      setResult(await api.runAgencyCustomReport(definition))
    } catch (err) {
      addToast({
        title: 'Could not run report',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setRunning(false)
    }
  }

  const saveReport = async () => {
    if (!canManage) return
    if (!name.trim()) {
      addToast({ title: 'Report name is required', variant: 'error' })
      return
    }
    if (!definition.metrics.length) {
      addToast({ title: 'Select at least one metric', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const payload = { name: name.trim(), definition }
      if (isNew) {
        const { report } = await api.createAgencyCustomReport(payload)
        addToast({ title: 'Report saved', variant: 'success' })
        navigate(`/agency/reports/custom/${report.id}`, { replace: true })
      } else if (id) {
        await api.updateAgencyCustomReport(id, payload)
        addToast({ title: 'Report saved', variant: 'success' })
      }
    } catch (err) {
      addToast({
        title: 'Could not save report',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center" data-screen="AGN-REP-008">
        <h1 className="text-2xl font-semibold text-[var(--lc-text-primary)]">Custom report builder</h1>
        <p className="mt-3 text-[var(--lc-text-muted)]">
          You need owner, admin, or finance access to compose custom agency reports.
        </p>
      </div>
    )
  }

  if (loadState === 'loading' || !catalog) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" data-screen="AGN-REP-008">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-label="Loading builder" />
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center" data-screen="AGN-REP-008">
        <h1 className="text-2xl font-semibold text-[var(--lc-text-primary)]">Custom report builder</h1>
        <p className="text-[var(--lc-text-muted)]">The builder could not be loaded.</p>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    )
  }

  const dimensionHeaders = definition.dimensions

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:py-8" data-screen="AGN-REP-008">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            to="/agency/reports"
            className="mb-3 inline-flex items-center text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
          >
            <ArrowLeft className="me-2 h-4 w-4" />
            Back to reports
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text-primary)] sm:text-3xl">
            Custom report builder
          </h1>
          <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
            Compose metrics, dimensions, and filters, then run the report across your agency.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void runReport()} disabled={running}>
            {running ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Play className="me-2 h-4 w-4" />}
            Run
          </Button>
          {canManage && (
            <Button onClick={() => void saveReport()} disabled={saving}>
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
            <CardDescription>Select one or more metrics to include.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {catalog.metrics.map((metric) => (
              <label key={metric.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={definition.metrics.includes(metric.key)}
                  onChange={() => toggleMetric(metric.key)}
                />
                <span>{metric.label}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle>Canvas</CardTitle>
            <CardDescription>Report name and selected configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-name">Report name</Label>
              <Input
                id="report-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canManage}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--lc-text-primary)]">Selected metrics</p>
              {definition.metrics.length === 0 ? (
                <p className="text-sm text-[var(--lc-text-muted)]">No metrics selected yet.</p>
              ) : (
                <ul className="space-y-1 text-sm text-[var(--lc-text-primary)]">
                  {definition.metrics.map((key) => (
                    <li key={key}>{metricLabelByKey.get(key) || key}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--lc-text-primary)]">Dimensions</p>
              {definition.dimensions.length === 0 ? (
                <p className="text-sm text-[var(--lc-text-muted)]">Totals only (no grouping).</p>
              ) : (
                <p className="text-sm text-[var(--lc-text-primary)]">
                  {definition.dimensions.map((key) => catalog.dimensions.find((d) => d.key === key)?.label || key).join(', ')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Dimensions & filters</CardTitle>
            <CardDescription>Group results and narrow the date range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--lc-text-primary)]">Group by</p>
              {catalog.dimensions.map((dimension) => (
                <label key={dimension.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={definition.dimensions.includes(dimension.key)}
                    onChange={() => toggleDimension(dimension.key)}
                  />
                  <span>{dimension.label}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="filter-date-from">Date from</Label>
                <Input
                  id="filter-date-from"
                  type="date"
                  value={definition.filters.date_from || ''}
                  onChange={(event) => updateFilter('date_from', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-date-to">Date to</Label>
                <Input
                  id="filter-date-to"
                  type="date"
                  value={definition.filters.date_to || ''}
                  onChange={(event) => updateFilter('date_to', event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="filter-area">Area contains</Label>
                <Input
                  id="filter-area"
                  value={definition.filters.area || ''}
                  onChange={(event) => updateFilter('area', event.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>Run the report to populate this table.</CardDescription>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-sm text-[var(--lc-text-muted)]">No results yet.</p>
          ) : result.rows.length === 0 ? (
            <p className="text-sm text-[var(--lc-text-muted)]">No rows matched your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--lc-border)] text-start text-[var(--lc-text-muted)]">
                    {dimensionHeaders.map((key) => (
                      <th key={key} className="px-2 py-2 font-medium">
                        {catalog.dimensions.find((d) => d.key === key)?.label || key}
                      </th>
                    ))}
                    {definition.metrics.map((key) => (
                      <th key={key} className="px-2 py-2 font-medium">
                        {metricLabelByKey.get(key) || key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={index} className="border-b border-[var(--lc-border)] last:border-0">
                      {dimensionHeaders.map((key) => (
                        <td key={key} className="px-2 py-2 text-[var(--lc-text-primary)]">
                          {row.dimensions[key] || '—'}
                        </td>
                      ))}
                      {definition.metrics.map((key) => (
                        <td key={key} className="px-2 py-2">
                          <Numeric>{Number(row.metrics[key] || 0).toFixed(0)}</Numeric>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
