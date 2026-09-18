/**
 * PA-CON-002 — Contract detail
 *
 * One contract: components, version timeline, lifecycle actions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
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
import { Numeric } from '@/components/ui/numeric'
import { FinAdminGate, FinTable } from './shell'

interface ContractComponent {
  id: string
  component_type: string
  price_code?: string | null
  price_unit_rate_minor?: number | null
  price_currency?: string | null
  config?: Record<string, unknown>
}

interface ContractVersion {
  id: string
  version_n: number
  status: string
  effective_from?: string | null
  effective_to?: string | null
  amendment_reason?: string | null
  components?: ContractComponent[]
}

interface ContractDetail {
  id: string
  contract_number: string
  tenant_display_name?: string
  tenant_public_id?: string
  tenant_id?: string
  status: string
  billing_currency?: string
  starts_at?: string | null
  ends_at?: string | null
  version?: number
  component_count?: number
  active_version?: ContractVersion | null
  draft_versions?: ContractVersion[]
  versions?: ContractVersion[]
}

function statusVariant(status: string) {
  if (status === 'ACTIVE') return 'default'
  if (status === 'DRAFT') return 'secondary'
  if (status === 'SUSPENDED') return 'outline'
  return 'secondary'
}

export function ContractDetailPage() {
  const { id = '' } = useParams()
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [terminateOpen, setTerminateOpen] = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const body = await api.finGet(`/contracts/${id}`) as unknown as ContractDetail
      setContract(body)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contract')
      setContract(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void reload()
  }, [reload])

  const activeComponents = useMemo(
    () => contract?.active_version?.components || [],
    [contract?.active_version?.components],
  )

  async function runAction(label: string, path: string, body: Record<string, unknown> = {}) {
    if (!id) return
    setBusy(label)
    try {
      await api.finPost(`/contracts/${id}${path}`, body)
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${label} failed`)
    } finally {
      setBusy(null)
    }
  }

  async function activateVersion(versionId: string) {
    await runAction('activate', `/versions/${versionId}/activate`, {
      expected_version: contract?.version,
    })
  }

  return (
    <FinAdminGate title="Contract detail">
      <Button asChild variant="ghost" size="sm" className="mb-4 ps-0">
        <Link to="/admin/fin/contracts">
          <ArrowLeft className="me-2 h-4 w-4" aria-hidden="true" />
          Contracts
        </Link>
      </Button>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading contract…
        </div>
      )}

      {!loading && error && !contract && (
        <div className="space-y-3">
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="outline" onClick={() => void reload()}>Retry</Button>
        </div>
      )}

      {!loading && contract && (
        <div className="space-y-6">
          {error && (
            <p className="text-sm text-red-500" role="alert">{error}</p>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{contract.contract_number}</h2>
              <p className="text-sm text-muted-foreground">
                {contract.tenant_public_id || contract.tenant_id}
                {contract.billing_currency ? ` · ${contract.billing_currency}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                Effective {contract.starts_at || '—'}
                {contract.ends_at ? ` → ${contract.ends_at}` : ''}
              </p>
            </div>
            <Badge variant={statusVariant(contract.status)}>{contract.status}</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Components</CardTitle>
            </CardHeader>
            <CardContent>
              {activeComponents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No components on the active version.</p>
              ) : (
                <FinTable
                  columns={['component_type', 'price_code', 'price_unit_rate_minor', 'price_currency']}
                  rows={activeComponents as unknown as Array<Record<string, unknown>>}
                />
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                <Numeric>{contract.component_count ?? activeComponents.length}</Numeric> component(s) on the active version.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(contract.versions || []).map((version) => (
                <div key={version.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        Version <Numeric>{version.version_n}</Numeric>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {version.effective_from || '—'}
                        {version.effective_to ? ` → ${version.effective_to}` : ''}
                      </div>
                      {version.amendment_reason && (
                        <div className="mt-1 text-xs text-muted-foreground">{version.amendment_reason}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(version.status)}>{version.status}</Badge>
                      {version.status === 'DRAFT' && contract.status !== 'TERMINATED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === 'activate'}
                          onClick={() => void activateVersion(version.id)}
                        >
                          {busy === 'activate' ? 'Activating…' : 'Activate'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!contract.versions?.length && (
                <p className="text-sm text-muted-foreground">No versions recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            {contract.status === 'ACTIVE' && (
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => void runAction('suspend', '/suspend')}
              >
                {busy === 'suspend' ? 'Suspending…' : 'Suspend'}
              </Button>
            )}
            {!['TERMINATED', 'EXPIRED'].includes(contract.status) && (
              <Button
                variant="destructive"
                disabled={!!busy}
                onClick={() => setTerminateOpen(true)}
              >
                Terminate
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate contract?</DialogTitle>
            <DialogDescription>
              This action is irreversible. Billing under {contract?.contract_number} will stop immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Termination is logged and notifies the tenant lifecycle channel.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busy === 'terminate'}
              onClick={() => {
                setTerminateOpen(false)
                void runAction('terminate', '/terminate')
              }}
            >
              {busy === 'terminate' ? 'Terminating…' : 'Terminate contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FinAdminGate>
  )
}
