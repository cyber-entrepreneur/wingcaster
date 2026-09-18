import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { pricingApi } from './pricing-api'

type PriceRow = {
  id: string
  code: string
  currency: string
  version?: number | string
}

const MODEL_OPTIONS = [
  { value: 'PER_UNIT', label: 'Per unit' },
  { value: 'FLAT', label: 'Flat rate' },
  { value: 'PACKAGE', label: 'Package' },
] as const

const REASON_OPTIONS = [
  { value: 'PRICE_CHANGE', label: 'Scheduled price change' },
  { value: 'PRICE_CORRECTION', label: 'Correction' },
  { value: 'PRICE_PROMOTION', label: 'Promotion' },
  { value: 'PRICE_OTHER', label: 'Other (document in approval)' },
] as const

function futureIsoFromLocal(value: string) {
  return new Date(value).toISOString()
}

export function CreatePriceVersionDialog({
  open,
  onOpenChange,
  prices,
  initialPriceId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prices: PriceRow[]
  initialPriceId?: string
  onCreated: (versionId: string) => void
}) {
  const [priceId, setPriceId] = useState('')
  const [model, setModel] = useState<(typeof MODEL_OPTIONS)[number]['value']>('PER_UNIT')
  const [unitRateMinor, setUnitRateMinor] = useState('')
  const [packageSizeUnits, setPackageSizeUnits] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [reasonCode, setReasonCode] = useState<string>(REASON_OPTIONS[0].value)
  const [priceVersion, setPriceVersion] = useState<number | string>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successVersionId, setSuccessVersionId] = useState<string | null>(null)

  const selected = useMemo(
    () => prices.find((row) => row.id === priceId) || null,
    [prices, priceId],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setSuccessVersionId(null)
    setModel('PER_UNIT')
    setUnitRateMinor('')
    setPackageSizeUnits('')
    setReasonCode(REASON_OPTIONS[0].value)
    const preferred = initialPriceId && prices.some((row) => row.id === initialPriceId)
      ? initialPriceId
      : prices[0]?.id || ''
    setPriceId(preferred)
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    setEffectiveFrom(now.toISOString().slice(0, 16))
  }, [open, prices, initialPriceId])

  useEffect(() => {
    if (!open || !priceId) return
    void pricingApi.get(priceId)
      .then((body) => {
        const version = body.version
        setPriceVersion(typeof version === 'number' || typeof version === 'string' ? version : 1)
      })
      .catch(() => setPriceVersion(selected?.version ?? 1))
  }, [open, priceId, selected?.version])

  const parsedRate = Number(unitRateMinor)
  const parsedPackage = Number(packageSizeUnits)
  const effectiveIso = effectiveFrom ? futureIsoFromLocal(effectiveFrom) : ''
  const effectivePast = effectiveIso ? Date.parse(effectiveIso) < Date.now() - 60_000 : false

  const canSave = model === 'PACKAGE'
    ? Number.isFinite(parsedPackage) && parsedPackage > 0
    : Number.isFinite(parsedRate) && parsedRate >= 0

  async function saveDraft() {
    if (!priceId || !canSave || !effectiveFrom) {
      setError('Price, effective-from, and pricing fields are required.')
      return
    }
    if (effectivePast) {
      setError('Effective-from cannot be in the past.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        model,
        effective_from: effectiveIso,
        reason_code: reasonCode,
      }
      if (model === 'PACKAGE') body.package_size_units = parsedPackage
      else body.unit_rate_minor = parsedRate
      const result = await pricingApi.draftVersion(priceId, body, priceVersion)
      const versionId = String(result.id || '')
      if (!versionId) throw new Error('Draft saved but no version id returned')
      setSuccessVersionId(versionId)
      onCreated(versionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save price version draft.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create price version</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="price-version-price">Price</Label>
            <select
              id="price-version-price"
              className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              value={priceId}
              onChange={(event) => setPriceId(event.target.value)}
            >
              {prices.length ? prices.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.currency}
                </option>
              )) : (
                <option value="">No prices loaded</option>
              )}
            </select>
          </div>

          {selected ? (
            <p className="text-sm text-muted-foreground">
              Header version <Numeric>{String(priceVersion)}</Numeric> · currency {selected.currency}
            </p>
          ) : null}

          <div>
            <Label htmlFor="price-version-model">Model</Label>
            <select
              id="price-version-model"
              className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              value={model}
              onChange={(event) => setModel(event.target.value as typeof model)}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {model === 'PACKAGE' ? (
            <div>
              <Label htmlFor="price-version-package">Package size (units)</Label>
              <Input
                id="price-version-package"
                inputMode="numeric"
                value={packageSizeUnits}
                onChange={(event) => setPackageSizeUnits(event.target.value)}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="price-version-rate">Unit rate (minor units)</Label>
              <Input
                id="price-version-rate"
                inputMode="numeric"
                value={unitRateMinor}
                onChange={(event) => setUnitRateMinor(event.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="price-version-effective">Effective from</Label>
            <Input
              id="price-version-effective"
              type="datetime-local"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="price-version-reason">Reason</Label>
            <select
              id="price-version-reason"
              className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {effectivePast ? (
            <p className="text-sm text-amber-700" role="status">Effective-from is in the past.</p>
          ) : null}
          {successVersionId ? (
            <p className="text-sm text-emerald-700" role="status">
              Draft saved: {successVersionId}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={submitting || !priceId || !canSave || effectivePast || Boolean(successVersionId)}
            onClick={() => { void saveDraft() }}
          >
            {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
