/**
 * PA-PRC-002 — Price detail + versions
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { FinAdminGate, FinTable } from './shell'
import { pricingApi } from './pricing-api'

interface PriceVersion {
  id: string
  version_n: number
  model: string
  unit_rate_minor?: number | null
  package_size_units?: number | null
  effective_from?: string | null
  effective_to?: string | null
  status: string
}

interface PriceDetail {
  id: string
  code: string
  currency: string
  meter_id?: string | null
  version?: number
  versions?: PriceVersion[]
}

function statusVariant(status: string) {
  if (status === 'ACTIVE') return 'default'
  if (status === 'DRAFT') return 'secondary'
  return 'outline'
}

export function PriceDetailPage() {
  const { id = '' } = useParams()
  const [price, setPrice] = useState<PriceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [draftOpen, setDraftOpen] = useState(false)
  const [unitRate, setUnitRate] = useState('100')
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString())

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const body = await pricingApi.get(id) as unknown as PriceDetail
      setPrice(body)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load price')
      setPrice(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void reload()
  }, [reload])

  const versions = useMemo(() => price?.versions || [], [price?.versions])
  const activeVersion = useMemo(
    () => versions.find((row) => row.status === 'ACTIVE') || null,
    [versions],
  )

  async function draftVersion() {
    if (!id || !price?.version) return
    setBusy('draft')
    setError(null)
    try {
      await pricingApi.draftVersion(id, {
        model: 'PER_UNIT',
        unit_rate_minor: Number(unitRate),
        effective_from: effectiveFrom,
      }, price.version)
      setDraftOpen(false)
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to draft version')
    } finally {
      setBusy(null)
    }
  }

  async function activateVersion(versionId: string) {
    if (!id || !price?.version) return
    setBusy(`activate-${versionId}`)
    setError(null)
    try {
      await pricingApi.activateVersion(id, versionId, {}, price.version)
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to activate version')
    } finally {
      setBusy(null)
    }
  }

  async function deprecateVersion(versionId: string) {
    if (!id || !price?.version) return
    setBusy(`deprecate-${versionId}`)
    setError(null)
    try {
      await pricingApi.deprecateVersion(id, versionId, {}, price.version)
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to deprecate version')
    } finally {
      setBusy(null)
    }
  }

  return (
    <FinAdminGate title="Price detail">
      <Button asChild variant="ghost" size="sm" className="mb-4 ps-0">
        <Link to="/admin/fin/pricing">
          <ArrowLeft className="me-2 h-4 w-4" aria-hidden="true" />
          Pricing
        </Link>
      </Button>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading price…
        </div>
      )}

      {!loading && error && !price && (
        <div className="space-y-3">
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="outline" onClick={() => void reload()}>Retry</Button>
        </div>
      )}

      {!loading && price && (
        <div className="space-y-6">
          {error && (
            <p className="text-sm text-red-500" role="alert">{error}</p>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{price.code}</h2>
              <p className="text-sm text-muted-foreground">
                {price.currency}
                {price.meter_id ? ` · meter ${price.meter_id}` : ''}
              </p>
            </div>
            <Button size="sm" onClick={() => setDraftOpen(true)}>New version</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active version</CardTitle>
            </CardHeader>
            <CardContent>
              {!activeVersion ? (
                <p className="text-sm text-muted-foreground">No ACTIVE version configured.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant={statusVariant(activeVersion.status)}>{activeVersion.status}</Badge>
                  <span>v<Numeric>{activeVersion.version_n}</Numeric></span>
                  <span>{activeVersion.model}</span>
                  {activeVersion.unit_rate_minor != null && (
                    <span>
                      <Numeric>{activeVersion.unit_rate_minor}</Numeric> {price.currency}/unit
                    </span>
                  )}
                  <span className="text-muted-foreground">{activeVersion.effective_from || '—'}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FinTable
                columns={['version_n', 'status', 'model', 'unit_rate_minor', 'effective_from', 'effective_to']}
                rows={versions as unknown as Array<Record<string, unknown>>}
              />
              <div className="flex flex-wrap gap-2">
                {versions.filter((row) => row.status === 'DRAFT').map((row) => (
                  <Button
                    key={row.id}
                    size="sm"
                    disabled={busy === `activate-${row.id}`}
                    onClick={() => void activateVersion(row.id)}
                  >
                    Activate v<Numeric>{row.version_n}</Numeric>
                  </Button>
                ))}
                {versions.filter((row) => row.status === 'ACTIVE').map((row) => (
                  <Button
                    key={row.id}
                    size="sm"
                    variant="outline"
                    disabled={busy === `deprecate-${row.id}`}
                    onClick={() => void deprecateVersion(row.id)}
                  >
                    Deprecate v<Numeric>{row.version_n}</Numeric>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft new price version</DialogTitle>
            <DialogDescription>
              Creates a DRAFT PER_UNIT version. Activate it from the timeline when ready.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="unit-rate">Unit rate (minor)</Label>
              <Input id="unit-rate" value={unitRate} onChange={(e) => setUnitRate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="effective-from">Effective from (ISO)</Label>
              <Input
                id="effective-from"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftOpen(false)}>Cancel</Button>
            <Button disabled={busy === 'draft'} onClick={() => void draftVersion()}>
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FinAdminGate>
  )
}
