/**
 * PA-CRD-008 — Credit reservation janitor worker status (advisory lock 1022).
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinAdminGate } from './shell'

type JanitorStatus = {
  worker?: string
  advisory_lock_class?: number
  backlog_count?: number
  lock_held?: boolean
  lock_holder?: {
    pid?: number
    usename?: string
    application_name?: string
    client_addr?: string
  } | null
  last_run_at?: string | null
  last_processed_count?: number
  last_skip_reason?: string | null
  status_updated_at?: string | null
}

export function CreditJanitorPage() {
  const { addToast } = useToast()
  const [status, setStatus] = useState<JanitorStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  function reload() {
    setLoading(true)
    void api.finGet('/credits/janitor/status')
      .then((body) => setStatus((body.status || null) as JanitorStatus | null))
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load janitor status',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  async function runNow() {
    setBusy(true)
    try {
      const result = await api.finPost('/credits/janitor/run')
      addToast({
        variant: 'success',
        title: 'Janitor run completed',
        description: `Processed ${String(result.processed ?? 0)} reservations`,
      })
      reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Janitor run failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const degraded = (status?.backlog_count ?? 0) > 0
  const stuckLock = Boolean(status?.lock_held && (status?.backlog_count ?? 0) > 0)

  return (
    <FinAdminGate title="Credit janitor">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Monitor the hanging-reservation janitor (advisory lock 1022) and trigger an elevated manual run.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-lg">Janitor status</CardTitle>
            <div className="flex items-center gap-2">
              {degraded ? <Badge variant="destructive">Backlog</Badge> : <Badge variant="secondary">Healthy</Badge>}
              {stuckLock ? <Badge variant="destructive">Lock held</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>Last run: <Numeric>{status?.last_run_at || 'never'}</Numeric></p>
              <p>Last processed: <Numeric>{String(status?.last_processed_count ?? 0)}</Numeric></p>
              <p>Current backlog: <Numeric>{String(status?.backlog_count ?? 0)}</Numeric></p>
              <p>Advisory lock class: <Numeric>{String(status?.advisory_lock_class ?? 1022)}</Numeric></p>
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
            <Button variant="outline" disabled={busy} onClick={() => void runNow()}>
              Run now
            </Button>
          </CardContent>
        </Card>
      )}
    </FinAdminGate>
  )
}

export default CreditJanitorPage
