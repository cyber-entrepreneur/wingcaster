/**
 * PA-CRD-009 — Credit → fin ledger mirror worker status (advisory lock 1023).
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinAdminGate } from './shell'

type FinMirrorStatus = {
  worker?: string
  advisory_lock_class?: number
  grant_backlog_count?: number
  consumption_backlog_count?: number
  backlog_count?: number
  lock_held?: boolean
  lock_holder?: {
    pid?: number
    usename?: string
    application_name?: string
    client_addr?: string
  } | null
  last_run_at?: string | null
  last_mirror_at?: string | null
  last_processed_count?: number
  last_skipped_rows?: number
  last_skip_reason?: string | null
  status_updated_at?: string | null
}

export function CreditFinMirrorPage() {
  const { addToast } = useToast()
  const [status, setStatus] = useState<FinMirrorStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  function reload() {
    setLoading(true)
    void api.finGet('/credits/fin-mirror/status')
      .then((body) => setStatus((body.status || null) as FinMirrorStatus | null))
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load fin mirror status',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  async function runTick(label: string) {
    setBusy(true)
    try {
      const result = await api.finPost('/credits/fin-mirror/run')
      addToast({
        variant: 'success',
        title: `${label} completed`,
        description: `Processed ${String(result.processed ?? 0)} mirror events`,
      })
      reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: `${label} failed`,
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const backlog = status?.backlog_count ?? 0
  const growing = backlog > 0
  const mirrorFailed = Boolean(status?.last_skip_reason && status.last_skip_reason !== 'CREDITS_FIN_MIRROR_LOCK_HELD')

  return (
    <FinAdminGate title="Fin mirror worker">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Monitor the credit → fin double-entry mirror worker (advisory lock 1023) and retry the backlog manually.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-lg">Mirror worker status</CardTitle>
            <div className="flex items-center gap-2">
              {mirrorFailed ? <Badge variant="destructive">Mirror failed</Badge> : null}
              {growing ? <Badge variant="destructive">Backlog growing</Badge> : <Badge variant="secondary">Healthy</Badge>}
              {status?.lock_held ? <Badge variant="secondary">Lock held</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>Last run: <Numeric>{status?.last_run_at || 'never'}</Numeric></p>
              <p>Last successful mirror: <Numeric>{status?.last_mirror_at || 'never'}</Numeric></p>
              <p>Total backlog: <Numeric>{String(backlog)}</Numeric></p>
              <p>Grant backlog: <Numeric>{String(status?.grant_backlog_count ?? 0)}</Numeric></p>
              <p>Consumption backlog: <Numeric>{String(status?.consumption_backlog_count ?? 0)}</Numeric></p>
              <p>Last processed: <Numeric>{String(status?.last_processed_count ?? 0)}</Numeric></p>
              <p>Last skipped rows: <Numeric>{String(status?.last_skipped_rows ?? 0)}</Numeric></p>
              <p>Advisory lock class: <Numeric>{String(status?.advisory_lock_class ?? 1023)}</Numeric></p>
            </div>
            {status?.last_skip_reason ? (
              <p className="text-[var(--lc-text-muted)]">
                Last skip reason: <Numeric>{status.last_skip_reason}</Numeric>
              </p>
            ) : null}
            {status?.lock_holder ? (
              <p className="text-[var(--lc-text-muted)]">
                Lock holder PID <Numeric>{String(status.lock_holder.pid ?? '')}</Numeric>
                {' · '}
                {status.lock_holder.application_name || status.lock_holder.usename || 'unknown host'}
              </p>
            ) : (
              <p className="text-[var(--lc-text-muted)]">Advisory lock is free.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void runTick('Run now')}>
                Run now
              </Button>
              <Button variant="outline" disabled={busy || backlog === 0} onClick={() => void runTick('Retry backlog')}>
                Retry failed batch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </FinAdminGate>
  )
}

export default CreditFinMirrorPage
