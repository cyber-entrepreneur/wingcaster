import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Download,
  ExternalLink,
  Flag,
  List,
  Loader2,
  Map,
  RefreshCw,
  Search,
} from 'lucide-react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { downloadCsv } from '@/lib/downloadCsv'
import { usePageTitle } from '@/lib/usePageTitle'
import type {
  AgencyComparable,
  AgencyComparablesFilters,
  AgencyComparablesResponse,
  AgencyComparableSource,
} from '@/types/marketPricing'

type BrowserView = 'list' | 'map'
type ReportReason = '' | 'fake_listing' | 'incorrect_price' | 'already_sold' | 'wrong_details' | 'other'

const EMPTY_FILTERS: AgencyComparablesFilters = {
  city: '',
  area: '',
  property_type: '',
  source: undefined,
  date_from: '',
  date_to: '',
  limit: 500,
}

export function AgencyComparablesPage() {
  const { agent, loading: authLoading } = useAuth()
  const agentId = agent?.id
  const { addToast } = useToast()
  const [draftFilters, setDraftFilters] = useState<AgencyComparablesFilters>(EMPTY_FILTERS)
  const [activeFilters, setActiveFilters] = useState<AgencyComparablesFilters>(EMPTY_FILTERS)
  const [data, setData] = useState<AgencyComparablesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<BrowserView>('list')
  const [selected, setSelected] = useState<AgencyComparable | null>(null)
  const [reporting, setReporting] = useState<AgencyComparable | null>(null)
  usePageTitle('Agency comparables')

  const load = useCallback(async (filters: AgencyComparablesFilters) => {
    if (!agentId) return
    setLoading(true)
    setError('')
    try {
      setData(await api.getAgencyPricingComparables(filters))
    } catch (loadError) {
      setData(null)
      setError(loadError instanceof Error ? loadError.message : 'Comparables could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void load(activeFilters)
  }, [activeFilters, load])

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault()
    setActiveFilters({ ...draftFilters })
  }

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS)
    setActiveFilters(EMPTY_FILTERS)
  }

  const exportRows = () => {
    const rows = data?.items || []
    const headers = [
      'source',
      'title',
      'location',
      'property_type',
      'evidence_date',
      'price',
      'currency',
      'strength',
    ]
    const csvRows = rows.map((row) => [
      row.source_label,
      row.title,
      row.location,
      row.property_type,
      row.evidence_date,
      row.price,
      row.currency,
      row.strength,
    ].map(csvCell).join(','))
    downloadCsv([headers.join(','), ...csvRows].join('\n'), `agency-comparables-${new Date().toISOString().slice(0, 10)}.csv`)
    addToast({
      title: 'Comparables exported',
      description: `${rows.length.toLocaleString()} filtered records downloaded.`,
      variant: 'default',
    })
  }

  if (authLoading || (loading && !data)) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading agency comparables</span>
      </main>
    )
  }

  if (!agent) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">Sign in to browse agency comparables</h1>
        <Button asChild className="mt-5">
          <Link to="/login?returnTo=%2Fagency%2Fpricing%2Fcomparables">Sign in</Link>
        </Button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-6 sm:px-6 lg:px-8" dir="auto">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/agency/pricing"
              className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              Agency price health
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">Comparables browser</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Review agency listings, external evidence, and verified team reports in one evidence workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void load(activeFilters)}
              disabled={loading}
            >
              <RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={exportRows} disabled={!data?.items.length}>
              <Download className="me-2 h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Filter evidence</CardTitle>
            <CardDescription>Combine market, property, source, and recorded-date filters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={applyFilters} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FilterInput
                  id="comparables-city"
                  label="City"
                  value={draftFilters.city}
                  placeholder="e.g. Dubai"
                  onChange={(city) => setDraftFilters((current) => ({ ...current, city }))}
                />
                <FilterInput
                  id="comparables-area"
                  label="Area"
                  value={draftFilters.area}
                  placeholder="e.g. Downtown"
                  onChange={(area) => setDraftFilters((current) => ({ ...current, area }))}
                />
                <FilterInput
                  id="comparables-property-type"
                  label="Property type"
                  value={draftFilters.property_type}
                  placeholder="e.g. apartment"
                  onChange={(property_type) => setDraftFilters((current) => ({ ...current, property_type }))}
                />
                <div className="space-y-2">
                  <Label htmlFor="comparables-source">Source</Label>
                  <select
                    id="comparables-source"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={draftFilters.source || ''}
                    onChange={(event) => setDraftFilters((current) => ({
                      ...current,
                      source: (event.target.value || undefined) as AgencyComparableSource | undefined,
                    }))}
                  >
                    <option value="">All sources</option>
                    <option value="internal">Agency listings</option>
                    <option value="external">External sources</option>
                    <option value="agent_report">Verified team reports</option>
                  </select>
                </div>
                <FilterInput
                  id="comparables-date-from"
                  label="Recorded from"
                  type="date"
                  value={draftFilters.date_from}
                  onChange={(date_from) => setDraftFilters((current) => ({ ...current, date_from }))}
                />
                <FilterInput
                  id="comparables-date-to"
                  label="Recorded to"
                  type="date"
                  value={draftFilters.date_to}
                  onChange={(date_to) => setDraftFilters((current) => ({ ...current, date_to }))}
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={clearFilters}>Clear filters</Button>
                <Button type="submit">
                  <Search className="me-2 h-4 w-4" aria-hidden="true" />
                  Apply filters
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error ? (
          <Card role="alert">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Comparables unavailable</h2>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <Button type="button" onClick={() => void load(activeFilters)}>Try again</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3" aria-label="Comparable summary">
              <SummaryCard label="Filtered records" value={data?.total || 0} />
              <SummaryCard label="Shown" value={data?.items.length || 0} />
              <SummaryCard label="Mapped" value={data?.coordinates_available || 0} />
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--lc-text-heading)]">Evidence results</h2>
                  <p className="text-sm text-muted-foreground">
                    Strength reflects source verification and record completeness; it is not a valuation.
                  </p>
                </div>
                <div className="inline-flex rounded-md border bg-[var(--lc-surface-raised)] p-1" aria-label="Result view">
                  <Button
                    type="button"
                    variant={view === 'list' ? 'secondary' : 'ghost'}
                    aria-pressed={view === 'list'}
                    onClick={() => setView('list')}
                  >
                    <List className="me-2 h-4 w-4" aria-hidden="true" />
                    List
                  </Button>
                  <Button
                    type="button"
                    variant={view === 'map' ? 'secondary' : 'ghost'}
                    aria-pressed={view === 'map'}
                    onClick={() => setView('map')}
                  >
                    <Map className="me-2 h-4 w-4" aria-hidden="true" />
                    Map
                  </Button>
                </div>
              </div>

              {!data?.items.length ? (
                <Card>
                  <CardContent className="py-14 text-center">
                    <Search className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
                    <h3 className="mt-4 font-semibold">No comparables match these filters</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Clear one or more filters to widen the evidence set.
                    </p>
                    <Button type="button" variant="outline" className="mt-5" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </CardContent>
                </Card>
              ) : view === 'list' ? (
                <ComparableList rows={data.items} onSelect={setSelected} onReport={setReporting} />
              ) : (
                <ComparableMap rows={data.items} onSelect={setSelected} />
              )}
            </section>
          </>
        )}
      </div>

      <ComparableDetail comparable={selected} onClose={() => setSelected(null)} onReport={(row) => {
        setSelected(null)
        setReporting(row)
      }} />
      <ReportComparableDialog comparable={reporting} onClose={() => setReporting(null)} />
    </main>
  )
}

function FilterInput({
  id,
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
}: {
  id: string
  label: string
  value?: string
  placeholder?: string
  type?: 'text' | 'date'
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value || ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <Numeric className="text-2xl font-bold text-[var(--lc-text-heading)]">{value}</Numeric>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function ComparableList({
  rows,
  onSelect,
  onReport,
}: {
  rows: AgencyComparable[]
  onSelect: (row: AgencyComparable) => void
  onReport: (row: AgencyComparable) => void
}) {
  return (
    <div className="space-y-3" data-testid="comparables-list">
      {rows.map((row) => (
        <Card key={`${row.source}-${row.id}`}>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-semibold">{row.title || row.location || 'Comparable evidence'}</h3>
                <SourceBadge source={row.source} label={row.source_label} />
                <StrengthBadge strength={row.strength} />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {[row.area_name, row.city, row.location, displayPropertyType(row.property_type)].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded <Numeric>{formatDate(row.evidence_date)}</Numeric>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Evidence price</p>
              <Numeric className="font-semibold">{formatMoney(row.price, row.currency)}</Numeric>
              <p className="mt-1 text-xs text-muted-foreground">
                <Numeric>{row.bedrooms ?? '—'}</Numeric> beds · <Numeric>{row.bathrooms ?? '—'}</Numeric> baths ·{' '}
                <Numeric>{row.area_sqm != null ? row.area_sqm.toLocaleString() : '—'}</Numeric> sqm
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onSelect(row)}>View detail</Button>
              <Button type="button" variant="ghost" onClick={() => onReport(row)} aria-label={`Report ${row.title || row.id}`}>
                <Flag className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ComparableMap({ rows, onSelect }: { rows: AgencyComparable[]; onSelect: (row: AgencyComparable) => void }) {
  const mapped = useMemo(
    () => rows.filter((row) => row.latitude != null && row.longitude != null),
    [rows],
  )
  const bounds = useMemo(() => {
    if (!mapped.length) return null
    const latitudes = mapped.map((row) => Number(row.latitude))
    const longitudes = mapped.map((row) => Number(row.longitude))
    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes),
    }
  }, [mapped])

  if (!bounds) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <Map className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">No mapped evidence in this result</h3>
          <p className="mt-1 text-sm text-muted-foreground">Use list view to review records without coordinates.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="comparables-map">
      <CardHeader>
        <CardTitle>Evidence map</CardTitle>
        <CardDescription>
          Relative geographic positions for records with coordinates. Select a marker for full evidence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-[28rem] overflow-hidden rounded-lg border bg-[var(--lc-surface-sunken)]" role="group" aria-label="Comparable evidence map">
          <div className="absolute inset-0 bg-[linear-gradient(var(--lc-border)_1px,transparent_1px),linear-gradient(90deg,var(--lc-border)_1px,transparent_1px)] bg-[size:48px_48px]" aria-hidden="true" />
          {mapped.map((row, index) => {
            const x = scaleCoordinate(Number(row.longitude), bounds.minLng, bounds.maxLng)
            const y = 100 - scaleCoordinate(Number(row.latitude), bounds.minLat, bounds.maxLat)
            return (
              <button
                key={`${row.source}-${row.id}`}
                type="button"
                className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--lc-focus-ring-contrast)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] shadow-[var(--lc-elevation-sm)]"
                style={{ insetInlineStart: `${x}%`, top: `${y}%`, zIndex: index + 1 }}
                onClick={() => onSelect(row)}
                aria-label={`${row.title || row.location || 'Comparable'} at ${formatMoney(row.price, row.currency)}`}
              >
                <Numeric>{index + 1}</Numeric>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Showing <Numeric>{mapped.length}</Numeric> of <Numeric>{rows.length}</Numeric> filtered records with coordinates.
        </p>
      </CardContent>
    </Card>
  )
}

function ComparableDetail({
  comparable,
  onClose,
  onReport,
}: {
  comparable: AgencyComparable | null
  onClose: () => void
  onReport: (row: AgencyComparable) => void
}) {
  if (!comparable) return null
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{comparable.title || comparable.location || 'Comparable evidence'}</DialogTitle>
          <DialogDescription>{comparable.source_label}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailField label="Evidence price" value={formatMoney(comparable.price, comparable.currency)} numeric />
          <DetailField label="Recorded date" value={formatDate(comparable.evidence_date)} numeric />
          <DetailField label="Property type" value={displayPropertyType(comparable.property_type) || 'Not provided'} />
          <DetailField label="Location" value={[comparable.area_name, comparable.city, comparable.location].filter(Boolean).join(' · ') || 'Not provided'} />
          <DetailField label="Bedrooms" value={comparable.bedrooms ?? 'Not provided'} numeric />
          <DetailField label="Bathrooms" value={comparable.bathrooms ?? 'Not provided'} numeric />
          <DetailField label="Area" value={comparable.area_sqm != null ? `${comparable.area_sqm.toLocaleString()} sqm` : 'Not provided'} numeric />
          <DetailField label="Comparable strength" value={`${comparable.strength} (${comparable.strength_score.toLocaleString()}/100)`} numeric />
        </div>
        <div className="flex flex-wrap gap-2">
          {comparable.detail_path && (
            <Button asChild variant="outline">
              <Link to={comparable.detail_path}>Open listing</Link>
            </Button>
          )}
          {comparable.source_url && (
            <Button asChild variant="outline">
              <a href={comparable.source_url} target="_blank" rel="noreferrer">
                Open source <ExternalLink className="ms-2 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onReport(comparable)}>
            <Flag className="me-2 h-4 w-4" aria-hidden="true" />
            Report inaccurate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Comparable evidence informs pricing decisions but is not an appraisal or completed-transaction guarantee.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function ReportComparableDialog({
  comparable,
  onClose,
}: {
  comparable: AgencyComparable | null
  onClose: () => void
}) {
  const { addToast } = useToast()
  const [reason, setReason] = useState<ReportReason>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (comparable) {
      setReason('')
      setNotes('')
    }
  }, [comparable])

  if (!comparable) return null

  const submit = async () => {
    if (!reason) return
    setSubmitting(true)
    try {
      await api.reportComparable({
        comparable_id: comparable.id,
        comparable_type: comparable.source,
        reason,
        notes: notes.trim() || undefined,
      })
      addToast({
        title: 'Comparable reported',
        description: 'The valuation review queue now shows this evidence.',
        variant: 'default',
      })
      onClose()
    } catch (error) {
      addToast({
        title: 'Report not submitted',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report inaccurate comparable</DialogTitle>
          <DialogDescription>
            Flag {comparable.title || comparable.location || 'this evidence'} for platform valuation review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comparable-report-reason">Reason</Label>
            <select
              id="comparable-report-reason"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
            >
              <option value="">Select a reason</option>
              <option value="fake_listing">Fake listing</option>
              <option value="incorrect_price">Incorrect price</option>
              <option value="already_sold">Already sold</option>
              <option value="wrong_details">Wrong details</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="comparable-report-notes">Review notes</Label>
            <textarea
              id="comparable-report-notes"
              rows={4}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Describe what appears inaccurate and what the reviewer should verify."
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="button" onClick={() => void submit()} disabled={!reason || submitting}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailField({ label, value, numeric = false }: { label: string; value: React.ReactNode; numeric?: boolean }) {
  return (
    <div className="rounded-md border bg-[var(--lc-surface-sunken)] p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {numeric ? <Numeric className="mt-1 block font-medium">{value}</Numeric> : <p className="mt-1 font-medium">{value}</p>}
    </div>
  )
}

function SourceBadge({ source, label }: { source: AgencyComparableSource; label: string }) {
  const glyph = source === 'agent_report' ? '◆' : source === 'external' ? '●' : '○'
  return <Badge variant="secondary">{glyph} {label}</Badge>
}

function StrengthBadge({ strength }: { strength: AgencyComparable['strength'] }) {
  const glyph = strength === 'strong' ? '●' : strength === 'moderate' ? '◐' : '○'
  return <Badge variant={strength === 'strong' ? 'default' : 'outline'}>{glyph} {strength}</Badge>
}

function formatMoney(value?: number | null, currency?: string | null) {
  if (value == null || !Number.isFinite(Number(value))) return 'Not provided'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(Number(value))
  } catch {
    return `${Number(value).toLocaleString()} ${currency || ''}`.trim()
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString()
}

function displayPropertyType(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : ''
}

function scaleCoordinate(value: number, min: number, max: number) {
  if (min === max) return 50
  return 8 + ((value - min) / (max - min)) * 84
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}
