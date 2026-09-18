/**
 * PA-ARE-002 — Area detail + editor
 *
 * Manage one area's identity, geometry, disclosure copy, sources, and scoring ops.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, MapPin, Plus, Trash2 } from 'lucide-react'
import { api, type AdminArea, type AdminAreaDetailResponse, type AdminAreaSource, type AdminSourceType } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'

interface AreaFormState {
  name: string
  name_ar: string
  slug: string
  level: string
  center_latitude: string
  center_longitude: string
  boundary_geojson: string
  summary: string
  summary_ar: string
  lifestyle_profile: string
  investment_outlook: string
}

function emptyForm(): AreaFormState {
  return {
    name: '',
    name_ar: '',
    slug: '',
    level: 'neighborhood',
    center_latitude: '',
    center_longitude: '',
    boundary_geojson: '',
    summary: '',
    summary_ar: '',
    lifestyle_profile: '',
    investment_outlook: '',
  }
}

function areaToForm(area: AdminArea): AreaFormState {
  return {
    name: area.name || '',
    name_ar: area.name_ar || '',
    slug: area.slug || '',
    level: area.level || 'neighborhood',
    center_latitude: String(area.center_latitude ?? ''),
    center_longitude: String(area.center_longitude ?? ''),
    boundary_geojson: area.boundary_geojson || '',
    summary: area.summary || '',
    summary_ar: area.summary_ar || '',
    lifestyle_profile: area.lifestyle_profile || '',
    investment_outlook: area.investment_outlook || '',
  }
}

function parseBoundaryPreview(geojsonText: string, centerLat: number, centerLng: number) {
  if (!geojsonText.trim()) return null
  try {
    const parsed = JSON.parse(geojsonText) as { type?: string; coordinates?: unknown }
    const coords =
      parsed.type === 'Polygon'
        ? (parsed.coordinates as number[][][])[0]
        : parsed.type === 'MultiPolygon'
          ? (parsed.coordinates as number[][][][])[0]?.[0]
          : null
    if (!coords?.length) return null
    const lats = coords.map((c) => c[1])
    const lngs = coords.map((c) => c[0])
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const pad = 0.0001
    const width = Math.max(maxLng - minLng, pad)
    const height = Math.max(maxLat - minLat, pad)
    const points = coords
      .map(([lng, lat]) => {
        const x = ((lng - minLng) / width) * 280 + 10
        const y = (1 - (lat - minLat) / height) * 180 + 10
        return `${x},${y}`
      })
      .join(' ')
    return { points, centerLat, centerLng }
  } catch {
    return null
  }
}

export function AdminAreaDetailPage({ mode = 'edit' }: { mode?: 'create' | 'edit' }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { addToast } = useToast()
  const isCreate = mode === 'create'

  const [form, setForm] = useState<AreaFormState>(emptyForm())
  const [area, setArea] = useState<AdminArea | null>(null)
  const [sources, setSources] = useState<AdminAreaSource[]>([])
  const [sourceTypes, setSourceTypes] = useState<AdminSourceType[]>([])
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [monthlySpend, setMonthlySpend] = useState<number | null>(null)
  const [budgetUsd, setBudgetUsd] = useState<number | null>(null)
  const [loading, setLoading] = useState(!isCreate)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newSourceTypeId, setNewSourceTypeId] = useState('')
  const [newSourceName, setNewSourceName] = useState('')

  const loadDetail = useCallback(async () => {
    if (isCreate || !id) return
    setLoading(true)
    setError(null)
    try {
      const [detail, types] = await Promise.all([
        api.getAdminAreaDetail(id) as Promise<AdminAreaDetailResponse>,
        api.listAdminSourceTypes() as Promise<{ items: AdminSourceType[] }>,
      ])
      setArea(detail.area)
      setForm(areaToForm(detail.area))
      setSources(detail.sources || [])
      setQuotaExceeded(Boolean(detail.google_budget?.quota_exceeded))
      setMonthlySpend(detail.google_budget?.monthly_spend_usd ?? null)
      setBudgetUsd(detail.google_budget?.budget_usd_monthly ?? null)
      setSourceTypes(types.items || [])
      if (types.items?.[0]?.id) setNewSourceTypeId(types.items[0].id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load area')
    } finally {
      setLoading(false)
    }
  }, [id, isCreate])

  useEffect(() => {
    if (!isAdmin) return
    if (isCreate) {
      void api.listAdminSourceTypes().then((types) => {
        const items = (types as { items: AdminSourceType[] }).items || []
        setSourceTypes(items)
        if (items[0]?.id) setNewSourceTypeId(items[0].id)
      })
      return
    }
    void loadDetail()
  }, [isAdmin, isCreate, loadDetail])

  const boundaryPreview = useMemo(() => {
    const lat = Number(form.center_latitude)
    const lng = Number(form.center_longitude)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    return parseBoundaryPreview(form.boundary_geojson, lat, lng)
  }, [form.boundary_geojson, form.center_latitude, form.center_longitude])

  function patchForm<K extends keyof AreaFormState>(key: K, value: AreaFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        name_ar: form.name_ar.trim() || undefined,
        slug: form.slug.trim(),
        level: form.level,
        center_latitude: Number(form.center_latitude),
        center_longitude: Number(form.center_longitude),
        boundary_geojson: form.boundary_geojson.trim() || null,
        summary: form.summary,
        summary_ar: form.summary_ar,
        lifestyle_profile: form.lifestyle_profile,
        investment_outlook: form.investment_outlook,
      }
      if (isCreate) {
        const created = await api.createAdminArea(payload) as AdminArea
        addToast({ title: 'Area created', description: created.name, variant: 'success' })
        navigate(`/admin/areas/${created.id}`)
        return
      }
      const updated = await api.updateAdminArea(id, payload) as AdminArea
      setArea(updated)
      setForm(areaToForm(updated))
      addToast({ title: 'Saved', description: 'Area profile updated.', variant: 'success' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed'
      setError(message)
      addToast({ title: 'Save failed', description: message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function toggleScoring() {
    if (!area) return
    try {
      const updated = area.status === 'scoring_enabled'
        ? await api.disableAreaScoring(area.id) as AdminArea
        : await api.enableAreaScoring(area.id) as AdminArea
      setArea(updated)
      addToast({
        title: updated.status === 'scoring_enabled' ? 'Scoring enabled' : 'Scoring disabled',
        variant: 'success',
      })
    } catch (err: unknown) {
      addToast({ title: 'Action failed', description: err instanceof Error ? err.message : 'Failed', variant: 'error' })
    }
  }

  async function refreshGoogleSignals() {
    if (!area) return
    setRefreshing(true)
    try {
      const result = await api.refreshAreaGoogleSignals(area.id)
      addToast({
        title: 'Google signals refreshed',
        description: `${result.signals_created ?? 0} new signal(s) added.`,
        variant: 'success',
      })
      await loadDetail()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refresh failed'
      if (/budget cap|quota/i.test(message)) setQuotaExceeded(true)
      addToast({ title: 'Refresh failed', description: message, variant: 'error' })
    } finally {
      setRefreshing(false)
    }
  }

  async function calculateScores() {
    if (!area) return
    setCalculating(true)
    try {
      const result = await api.calculateAdminScores(area.id) as { calculated: number }
      addToast({
        title: 'Scores calculated',
        description: `${result.calculated} dimension score(s) updated.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      addToast({ title: 'Calculation failed', description: err instanceof Error ? err.message : 'Failed', variant: 'error' })
    } finally {
      setCalculating(false)
    }
  }

  async function addSource() {
    if (!area || !newSourceTypeId) return
    try {
      await api.createAdminAreaSource(area.id, {
        source_type_id: newSourceTypeId,
        name: newSourceName.trim() || undefined,
      })
      setNewSourceName('')
      await loadDetail()
      addToast({ title: 'Source added', variant: 'success' })
    } catch (err: unknown) {
      addToast({ title: 'Add source failed', description: err instanceof Error ? err.message : 'Failed', variant: 'error' })
    }
  }

  async function removeSource(sourceId: string) {
    if (!area) return
    try {
      await api.deleteAdminAreaSource(area.id, sourceId)
      await loadDetail()
      addToast({ title: 'Source removed', variant: 'success' })
    } catch (err: unknown) {
      addToast({ title: 'Remove failed', description: err instanceof Error ? err.message : 'Failed', variant: 'error' })
    }
  }

  if (!isAdmin) {
    return <div className="container py-8 text-sm text-red-500">Platform admin access required.</div>
  }

  if (loading) {
    return (
      <div className="container flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading area…
      </div>
    )
  }

  if (!isCreate && error && !area) {
    return (
      <div className="container py-8">
        <p className="text-sm text-red-500">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/admin/areas">Back to areas</Link>
        </Button>
      </div>
    )
  }

  const scoringEnabled = area?.status === 'scoring_enabled'

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 ps-0">
            <Link to="/admin/areas">
              <ArrowLeft className="me-2 h-4 w-4" aria-hidden="true" />
              Areas
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {isCreate ? 'Create area' : area?.name || 'Area detail'}
          </h1>
          {!isCreate && area && (
            <p className="mt-1 text-sm text-muted-foreground">
              {area.slug} · {area.level}
              {area.last_google_signals_refresh_at && (
                <> · Last Google refresh <time dateTime={area.last_google_signals_refresh_at}>{area.last_google_signals_refresh_at}</time></>
              )}
            </p>
          )}
        </div>
        {!isCreate && area && (
          <Badge variant={scoringEnabled ? 'default' : 'secondary'}>{area.status}</Badge>
        )}
      </div>

      {quotaExceeded && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid="quota-exceeded-banner"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            Google Maps monthly budget reached
            {monthlySpend != null && budgetUsd != null && (
              <> (<Numeric>{monthlySpend}</Numeric> / <Numeric>{budgetUsd}</Numeric> USD)</>
            )}
            . Signal refresh is blocked until the budget resets or is increased in configuration.
          </div>
        </div>
      )}

      {error && area && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="area-name">Name</Label>
              <Input id="area-name" value={form.name} onChange={(e) => patchForm('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-name-ar">Name (Arabic)</Label>
              <Input id="area-name-ar" value={form.name_ar} onChange={(e) => patchForm('name_ar', e.target.value)} dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-slug">Slug</Label>
              <Input id="area-slug" value={form.slug} onChange={(e) => patchForm('slug', e.target.value)} required pattern="[a-z0-9-]+" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-level">Level</Label>
              <select
                id="area-level"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.level}
                onChange={(e) => patchForm('level', e.target.value)}
              >
                <option value="city">City</option>
                <option value="village">Village</option>
                <option value="neighborhood">Neighborhood</option>
                <option value="territory">Territory</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-lat">Center latitude</Label>
              <Input id="area-lat" inputMode="decimal" value={form.center_latitude} onChange={(e) => patchForm('center_latitude', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-lng">Center longitude</Label>
              <Input id="area-lng" inputMode="decimal" value={form.center_longitude} onChange={(e) => patchForm('center_longitude', e.target.value)} required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Boundary polygon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="area-boundary">GeoJSON (Polygon or MultiPolygon)</Label>
              <textarea
                id="area-boundary"
                className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                value={form.boundary_geojson}
                onChange={(e) => patchForm('boundary_geojson', e.target.value)}
                placeholder='{"type":"Polygon","coordinates":[[[55.14,25.08],[55.15,25.08],[55.15,25.09],[55.14,25.09],[55.14,25.08]]]}'
              />
            </div>
            <div className="rounded-lg border bg-gray-50 p-3" aria-label="Boundary preview">
              {boundaryPreview ? (
                <svg viewBox="0 0 300 200" className="h-48 w-full" role="img">
                  <polygon
                    points={boundaryPreview.points}
                    fill="var(--lc-accent-subtle)"
                    stroke="var(--lc-accent)"
                    strokeWidth="2"
                  />
                </svg>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  <MapPin className="me-2 h-4 w-4" aria-hidden="true" />
                  Enter valid GeoJSON to preview the polygon
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disclosure fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="area-summary">Summary</Label>
              <textarea id="area-summary" className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.summary} onChange={(e) => patchForm('summary', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-summary-ar">Summary (Arabic)</Label>
              <textarea id="area-summary-ar" dir="rtl" className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.summary_ar} onChange={(e) => patchForm('summary_ar', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-lifestyle">Lifestyle profile</Label>
              <textarea id="area-lifestyle" className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.lifestyle_profile} onChange={(e) => patchForm('lifestyle_profile', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-investment">Investment outlook</Label>
              <textarea id="area-investment" className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.investment_outlook} onChange={(e) => patchForm('investment_outlook', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {!isCreate && area && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sources linked to this area yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {sources.map((source) => {
                      const type = sourceTypes.find((st) => st.id === source.source_type_id)
                      return (
                        <li key={source.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <div className="font-medium">{source.name || type?.name || 'Source'}</div>
                            <div className="text-xs text-muted-foreground">{type?.input_method || source.source_type_id}</div>
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={() => void removeSource(source.id)}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Remove source</span>
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div className="flex flex-wrap items-end gap-2 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-source-type">Source type</Label>
                    <select
                      id="new-source-type"
                      className="flex h-10 min-w-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newSourceTypeId}
                      onChange={(e) => setNewSourceTypeId(e.target.value)}
                    >
                      {sourceTypes.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-source-name">Label (optional)</Label>
                    <Input id="new-source-name" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} />
                  </div>
                  <Button type="button" variant="outline" onClick={() => void addSource()}>
                    <Plus className="me-2 h-4 w-4" aria-hidden="true" />
                    Add source
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scoring operations</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button type="button" variant={scoringEnabled ? 'secondary' : 'default'} onClick={() => void toggleScoring()}>
                  {scoringEnabled ? 'Disable scoring' : 'Enable scoring'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!scoringEnabled || refreshing || quotaExceeded}
                  onClick={() => void refreshGoogleSignals()}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh Google signals'}
                </Button>
                <Button type="button" variant="outline" disabled={!scoringEnabled || calculating} onClick={() => void calculateScores()}>
                  {calculating ? 'Calculating…' : 'Calculate scores'}
                </Button>
                <Button asChild type="button" variant="ghost">
                  <Link to="/admin/scoring">Scoring dimensions</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isCreate ? 'Create area' : 'Save changes'}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/admin/areas">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
