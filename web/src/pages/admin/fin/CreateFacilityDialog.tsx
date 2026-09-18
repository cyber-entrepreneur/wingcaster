import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type TenantOption = {
  id: string
  public_tenant_id: string
  billing_account_id?: string
}

const REASON_OPTIONS = [
  { value: 'FACILITY_ONBOARDING', label: 'Onboarding facility' },
  { value: 'FACILITY_SUPPORT', label: 'Support case remediation' },
  { value: 'FACILITY_PARTNERSHIP', label: 'Partnership credit line' },
  { value: 'FACILITY_OTHER', label: 'Other (document in notes)' },
] as const

const NET_TERMS = [7, 14, 30] as const

export function CreateFacilityDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (facilityId: string) => void
}) {
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [tenantId, setTenantId] = useState('')
  const [billingAccountId, setBillingAccountId] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [limitMinor, setLimitMinor] = useState('')
  const [netTermsDays, setNetTermsDays] = useState<number>(30)
  const [reasonCode, setReasonCode] = useState<string>(REASON_OPTIONS[0].value)
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loadingTenant, setLoadingTenant] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void api.finGet('/tenants').then((body) => {
      setTenants((body.tenants || []) as TenantOption[])
    }).catch(() => setTenants([]))
  }, [open])

  useEffect(() => {
    if (!tenantId) {
      setBillingAccountId('')
      return
    }
    setLoadingTenant(true)
    void api.finGet(`/tenants/${tenantId}`)
      .then((body) => {
        setBillingAccountId(String(body.billing_account_id || ''))
      })
      .catch(() => setBillingAccountId(''))
      .finally(() => setLoadingTenant(false))
  }, [tenantId])

  function resetForm() {
    setTenantId('')
    setBillingAccountId('')
    setCurrency('USD')
    setLimitMinor('')
    setNetTermsDays(30)
    setReasonCode(REASON_OPTIONS[0].value)
    setEvidenceUrl('')
    setNotes('')
    setError(null)
  }

  async function submit() {
    if (!tenantId || !billingAccountId || !limitMinor) {
      setError('Tenant, billing account, and limit are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        tenant_id: tenantId,
        billing_account_id: billingAccountId,
        currency: currency.toUpperCase(),
        limit_minor: Number(limitMinor),
        net_terms_days: netTermsDays,
        reason_code: reasonCode,
      }
      if (evidenceUrl.trim()) body.evidence_url = evidenceUrl.trim()
      if (notes.trim()) body.notes = notes.trim()
      const result = await api.finPost('/facilities', body)
      const facilityId = String(result.facilityId || result.id || '')
      if (!facilityId) throw new Error('Facility created but no ID returned')
      resetForm()
      onOpenChange(false)
      onCreated(facilityId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) resetForm()
      onOpenChange(next)
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create facility</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Opens a new credit facility in PENDING status. Activation follows WF-18 when above threshold.
        </p>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Tenant</span>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="h-9 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-3 text-sm"
            >
              <option value="">Select tenant…</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.public_tenant_id || tenant.id}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Billing account</span>
            <Input
              value={billingAccountId}
              readOnly
              placeholder={loadingTenant ? 'Loading…' : 'Select a tenant'}
              className="font-mono text-xs"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Currency</span>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="USD"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Limit (minor units)</span>
              <Input
                value={limitMinor}
                onChange={(e) => setLimitMinor(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="500000"
              />
            </label>
          </div>
          {limitMinor && (
            <p className="text-xs text-muted-foreground">
              Limit: <Numeric>{limitMinor}</Numeric> minor units
            </p>
          )}
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Billing cycle (net terms)</span>
            <select
              value={netTermsDays}
              onChange={(e) => setNetTermsDays(Number(e.target.value))}
              className="h-9 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-3 text-sm"
            >
              {NET_TERMS.map((days) => (
                <option key={days} value={days}>{days} days</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Reason</span>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="h-9 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-3 text-sm"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Evidence URL (optional)</span>
            <Input
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Notes (optional)</span>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ticket link or executive approval reference"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={submitting} onClick={() => { void submit() }}>
            {submitting ? 'Submitting…' : 'Open facility'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
