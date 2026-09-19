/**
 * PA-CON-003 — Create / edit contract version
 *
 * Draft a contract version with component composition, preview total, save,
 * and submit-for-activation (draft + activate).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { FinAdminGate } from './shell'

const COMPONENT_TYPES = [
  'METER_PRICE',
  'OVERAGE_PRICE',
  'INCLUDED_ALLOWANCE',
  'MINIMUM_SPEND',
  'SUBSCRIPTION',
  'PREPAID_COMMITMENT',
  'PROMOTIONAL_GRANT',
  'ENTITLEMENT',
  'CREDIT_FACILITY',
  'ROLLOVER',
  'USAGE_LIMIT',
  'BILLING_RULE',
] as const

interface ContractHeader {
  id: string
  contract_number: string
  status: string
  billing_currency?: string
  version?: number
}

interface PriceCatalogRow {
  id: string
  code: string
  currency: string
  unit_rate_minor?: number | null
}

interface ComponentRow {
  key: string
  component_type: typeof COMPONENT_TYPES[number]
  price_id: string
  quantity: string
}

function emptyRow(): ComponentRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    component_type: 'METER_PRICE',
    price_id: '',
    quantity: '1',
  }
}

export function ContractVersionEditorPage() {
  const { contractId = '' } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState<ContractHeader | null>(null)
  const [prices, setPrices] = useState<PriceCatalogRow[]>([])
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [amendmentReason, setAmendmentReason] = useState('')
  const [rows, setRows] = useState<ComponentRow[]>([emptyRow()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!contractId) return
    setLoading(true)
    setError(null)
    try {
      const [contractsBody, catalogBody] = await Promise.all([
        api.finGet('/contracts') as Promise<{ contracts?: ContractHeader[] }>,
        api.finGet('/prices/active-catalog') as Promise<{ prices?: PriceCatalogRow[] }>,
      ])
      const match = (contractsBody.contracts || []).find((c) => c.id === contractId) || null
      if (!match) {
        setError('Contract not found')
        setContract(null)
      } else {
        setContract(match)
      }
      const catalog = catalogBody.prices || []
      setPrices(catalog)
      if (catalog[0]?.id) {
        setRows([{ ...emptyRow(), price_id: catalog[0].id }])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load editor')
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => {
    void load()
  }, [load])

  const previewTotalMinor = useMemo(() => {
    return rows.reduce((sum, row) => {
      const price = prices.find((p) => p.id === row.price_id)
      const qty = Number(row.quantity)
      if (!price || Number.isNaN(qty) || qty <= 0) return sum
      return sum + Number(price.unit_rate_minor || 0) * qty
    }, 0)
  }, [rows, prices])

  function patchRow(key: string, patch: Partial<ComponentRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)))
  }

  function validate(): boolean {
    if (!effectiveFrom.trim()) {
      setValidationError('Effective from is required.')
      return false
    }
    if (rows.some((row) => row.component_type === 'METER_PRICE' && !row.price_id)) {
      setValidationError('Each meter price row must select an active price.')
      return false
    }
    setValidationError(null)
    return true
  }

  function buildPayload() {
    return {
      effective_from: new Date(effectiveFrom).toISOString(),
      effective_to: effectiveTo.trim() ? new Date(effectiveTo).toISOString() : null,
      amendment_reason: amendmentReason.trim() || null,
      components: rows.map((row) => ({
        component_type: row.component_type,
        price_id: row.price_id || null,
        config: { quantity: Number(row.quantity) || 1 },
      })),
    }
  }

  async function saveDraft() {
    if (!contract || !validate()) return
    setSaving(true)
    setError(null)
    try {
      await api.finPost(`/contracts/${contract.id}/versions`, buildPayload())
      navigate('/admin/fin/contracts')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function submitForActivation() {
    if (!contract || !validate()) return
    setSaving(true)
    setError(null)
    try {
      const drafted = await api.finPost(`/contracts/${contract.id}/versions`, buildPayload()) as { id: string }
      await api.finPost(`/contracts/${contract.id}/versions/${drafted.id}/activate`, {
        expected_version: contract.version,
      })
      navigate('/admin/fin/contracts')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Activation failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FinAdminGate title="Contract version editor">
      <Button asChild variant="ghost" size="sm" className="mb-4 ps-0">
        <Link to="/admin/fin/contracts">
          <ArrowLeft className="me-2 h-4 w-4" aria-hidden="true" />
          Contracts
        </Link>
      </Button>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading editor…
        </div>
      )}

      {!loading && error && !contract && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!loading && contract && (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            void saveDraft()
          }}
        >
          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
          {validationError && <p className="text-sm text-amber-700" role="alert">{validationError}</p>}

          <Card>
            <CardHeader>
              <CardTitle>{contract.contract_number}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="effective-from">Effective from</Label>
                <Input
                  id="effective-from"
                  type="datetime-local"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effective-to">Effective until (optional)</Label>
                <Input
                  id="effective-to"
                  type="datetime-local"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="amendment-reason">Amendment reason</Label>
                <Input
                  id="amendment-reason"
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  placeholder="Describe why this version is being drafted"
                />
              </div>
              <div className="text-sm text-muted-foreground md:col-span-2">
                Currency: {contract.billing_currency || '—'} · Status: {contract.status}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Components</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
                <Plus className="me-2 h-4 w-4" aria-hidden="true" />
                Add row
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((row) => (
                <div key={row.key} className="grid gap-2 rounded-lg border p-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={row.component_type}
                      onChange={(e) => patchRow(row.key, { component_type: e.target.value as ComponentRow['component_type'] })}
                    >
                      {COMPONENT_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Active price</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={row.price_id}
                      onChange={(e) => patchRow(row.key, { price_id: e.target.value })}
                    >
                      <option value="">Select price…</option>
                      {prices.map((price) => (
                        <option key={price.id} value={price.id}>
                          {price.code} ({price.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="grow space-y-1">
                      <Label>Quantity</Label>
                      <Input
                        inputMode="numeric"
                        value={row.quantity}
                        onChange={(e) => patchRow(row.key, { quantity: e.target.value })}
                      />
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => removeRow(row.key)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Remove row</span>
                    </Button>
                  </div>
                </div>
              ))}
              {prices.length === 0 && (
                <p className="text-sm text-muted-foreground">No active prices in catalog — publish prices before composing a contract version.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview total</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              Estimated metered total:{' '}
              <Numeric>{previewTotalMinor}</Numeric>{' '}
              minor units ({contract.billing_currency || '—'})
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            <Button type="button" variant="default" disabled={saving} onClick={() => void submitForActivation()}>
              Submit for activation
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/admin/fin/contracts">Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </FinAdminGate>
  )
}
