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
import { vendorApi } from './vendor-api'

type VendorRow = {
  id: string
  name: string
  code?: string
  currency?: string
}

type VendorProduct = {
  product_code: string
  product_class?: string
}

function futureIsoFromLocal(value: string) {
  return new Date(value).toISOString()
}

export function AddVendorRateDialog({
  open,
  onOpenChange,
  vendors,
  initialVendorId,
  onApplied,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendors: VendorRow[]
  initialVendorId?: string
  onApplied: () => void
}) {
  const [vendorId, setVendorId] = useState('')
  const [products, setProducts] = useState<VendorProduct[]>([])
  const [rateKey, setRateKey] = useState('')
  const [customRateKey, setCustomRateKey] = useState('')
  const [unitCostMinor, setUnitCostMinor] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingApproval, setPendingApproval] = useState<string | null>(null)

  const selected = useMemo(
    () => vendors.find((row) => row.id === vendorId) || null,
    [vendors, vendorId],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setPendingApproval(null)
    setUnitCostMinor('')
    setCustomRateKey('')
    const preferred = initialVendorId && vendors.some((row) => row.id === initialVendorId)
      ? initialVendorId
      : vendors[0]?.id || ''
    setVendorId(preferred)
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    setEffectiveFrom(now.toISOString().slice(0, 16))
  }, [open, vendors, initialVendorId])

  useEffect(() => {
    if (!open || !vendorId) {
      setProducts([])
      setRateKey('')
      return
    }
    void vendorApi.get(vendorId)
      .then((body) => {
        const list = (body.products || []) as VendorProduct[]
        setProducts(list)
        setRateKey(list[0]?.product_code || '')
        setCurrency(String(selected?.currency || body.currency || 'USD'))
      })
      .catch(() => {
        setProducts([])
        setRateKey('')
      })
  }, [open, vendorId, selected?.currency])

  const resolvedRateKey = rateKey === '__custom__' ? customRateKey.trim() : rateKey
  const parsedCost = Number(unitCostMinor)
  const effectiveIso = effectiveFrom ? futureIsoFromLocal(effectiveFrom) : ''
  const effectivePast = effectiveIso ? Date.parse(effectiveIso) < Date.now() - 60_000 : false

  async function submit() {
    if (!vendorId || !resolvedRateKey || !Number.isFinite(parsedCost) || parsedCost < 0 || !effectiveFrom) {
      setError('Vendor, rate key, unit cost, and effective-from are required.')
      return
    }
    if (effectivePast) {
      setError('Effective-from cannot be in the past.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await vendorApi.applyRate(vendorId, {
        product_code: resolvedRateKey,
        unit_cost_minor: parsedCost,
        currency: currency.toUpperCase(),
        effective_from: effectiveIso,
      })
      if (result.status === 'PENDING_APPROVAL') {
        setPendingApproval(String(result.approval_request_id || 'pending'))
        onApplied()
        return
      }
      onOpenChange(false)
      onApplied()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply vendor rate.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add vendor rate</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="vendor-rate-vendor">Vendor</Label>
            <select
              id="vendor-rate-vendor"
              className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
            >
              {vendors.length ? vendors.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name || row.code || row.id.slice(0, 8)}
                </option>
              )) : (
                <option value="">No vendors loaded</option>
              )}
            </select>
          </div>

          <div>
            <Label htmlFor="vendor-rate-key">Rate key</Label>
            <select
              id="vendor-rate-key"
              className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              value={rateKey}
              onChange={(event) => setRateKey(event.target.value)}
            >
              {products.map((product) => (
                <option key={product.product_code} value={product.product_code}>
                  {product.product_code}
                </option>
              ))}
              <option value="__custom__">Custom rate key…</option>
            </select>
          </div>

          {rateKey === '__custom__' ? (
            <div>
              <Label htmlFor="vendor-rate-custom-key">Custom rate key</Label>
              <Input
                id="vendor-rate-custom-key"
                value={customRateKey}
                onChange={(event) => setCustomRateKey(event.target.value)}
                placeholder="gpt-4o-mini.input_tokens"
              />
            </div>
          ) : null}

          <div>
            <Label htmlFor="vendor-rate-cost">Unit cost (minor units)</Label>
            <Input
              id="vendor-rate-cost"
              inputMode="numeric"
              value={unitCostMinor}
              onChange={(event) => setUnitCostMinor(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="vendor-rate-currency">Currency</Label>
            <Input
              id="vendor-rate-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>

          <div>
            <Label htmlFor="vendor-rate-effective">Effective from</Label>
            <Input
              id="vendor-rate-effective"
              type="datetime-local"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </div>

          {effectivePast ? (
            <p className="text-sm text-amber-700" role="status">Effective-from is in the past.</p>
          ) : null}
          {pendingApproval ? (
            <p className="text-sm text-amber-700" role="status">
              Submitted for approval: {pendingApproval}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting || !vendorId || !resolvedRateKey || effectivePast}
            onClick={() => { void submit() }}
          >
            {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
