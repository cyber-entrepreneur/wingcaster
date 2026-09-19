import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ScopeKind = 'platform' | 'tenant' | 'check'

type RunReconciliationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted: (runId: string | null) => void
}

export function RunReconciliationDialog({
  open,
  onOpenChange,
  onCompleted,
}: RunReconciliationDialogProps) {
  const [scopeKind, setScopeKind] = useState<ScopeKind>('platform')
  const [tenantId, setTenantId] = useState('')
  const [checkCode, setCheckCode] = useState('R001')
  const [reasonCode, setReasonCode] = useState('MANUAL')
  const [tenants, setTenants] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successRunId, setSuccessRunId] = useState<string | null>(null)
  const [skippedReason, setSkippedReason] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSuccessRunId(null)
    setSkippedReason(null)
    setScopeKind('platform')
    setReasonCode('MANUAL')
    setCheckCode('R001')
    void api.finGet('/tenants').then((body) => {
      const list = (body.tenants || []) as Array<Record<string, unknown>>
      setTenants(list)
      if (list[0]?.id) setTenantId(String(list[0].id))
    })
  }, [open])

  const canStart = scopeKind === 'platform'
    || (scopeKind === 'tenant' && tenantId)
    || (scopeKind === 'check' && checkCode.trim())

  async function start() {
    if (!canStart) return
    setLoading(true)
    setError(null)
    setSuccessRunId(null)
    setSkippedReason(null)
    try {
      const body: Record<string, unknown> = {
        scope_kind: scopeKind,
        reason_code: reasonCode.trim() || 'MANUAL',
      }
      if (scopeKind === 'tenant') body.tenant_id = tenantId
      if (scopeKind === 'check') body.check_code = checkCode.trim()
      const result = await api.finPost('/reconciliation/run', body)
      if (result.skipped) {
        setSkippedReason(String(result.reason || 'SKIPPED'))
        onCompleted(null)
        return
      }
      const runId = String(result.runId || result.id || '')
      setSuccessRunId(runId || null)
      onCompleted(runId || null)
    } catch {
      setError('Could not start reconciliation run.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Run reconciliation</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Scope</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="recon-scope"
                checked={scopeKind === 'platform'}
                onChange={() => setScopeKind('platform')}
              />
              All tenants
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="recon-scope"
                checked={scopeKind === 'tenant'}
                onChange={() => setScopeKind('tenant')}
              />
              One tenant
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="recon-scope"
                checked={scopeKind === 'check'}
                onChange={() => setScopeKind('check')}
              />
              One check
            </label>
          </fieldset>

          {scopeKind === 'tenant' ? (
            <div>
              <Label htmlFor="recon-tenant">Tenant</Label>
              <select
                id="recon-tenant"
                className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              >
                {tenants.length ? tenants.map((tenant) => (
                  <option key={String(tenant.id)} value={String(tenant.id)}>
                    {String(tenant.public_tenant_id || tenant.id)}
                  </option>
                )) : (
                  <option value="">No tenants loaded</option>
                )}
              </select>
            </div>
          ) : null}

          {scopeKind === 'check' ? (
            <div>
              <Label htmlFor="recon-check">Check code</Label>
              <Input
                id="recon-check"
                value={checkCode}
                onChange={(event) => setCheckCode(event.target.value)}
                placeholder="R001"
              />
            </div>
          ) : null}

          <div>
            <Label htmlFor="recon-reason">Reason code</Label>
            <Input
              id="recon-reason"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              placeholder="MANUAL"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          ) : null}
          {successRunId ? (
            <p className="text-sm text-emerald-700" role="status">
              Run started: {successRunId}
            </p>
          ) : null}
          {skippedReason ? (
            <p className="text-sm text-amber-700" role="status">
              Run skipped: {skippedReason}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={loading || !canStart || Boolean(successRunId)} onClick={() => { void start() }}>
            {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
