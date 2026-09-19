/**
 * PA-DUN-001 — Dunning cases index (exception handling for past-due invoices).
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useStepUp } from '@/context/StepUpContext'
import { useToast } from '@/components/ui/toast'
import { FinAdminGate, FinTable } from './shell'

const OPEN_STATUSES = new Set([
  'OPEN', 'REMINDING', 'REMIND_ESCALATED', 'CREDIT_PAUSED',
  'USAGE_SUSPENDED', 'LEGAL', 'WRITE_OFF_REVIEW',
])

export function DunningCasesPage() {
  const { runElevated } = useStepUp()
  const { addToast } = useToast()

  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)

  function reload() {
    setLoading(true)
    void api.finGet('/dunning/cases')
      .then((body) => setRows((body.cases || []) as Array<Record<string, unknown>>))
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load dunning cases',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows
    if (statusFilter === 'open') {
      return rows.filter((row) => OPEN_STATUSES.has(String(row.status || '')))
    }
    return rows.filter((row) => String(row.status || '') === statusFilter)
  }, [rows, statusFilter])

  async function act(path: string, label: string) {
    if (!selected?.id) {
      addToast({ variant: 'error', title: 'Select a dunning case first.' })
      return
    }
    setBusy(true)
    try {
      const result = await runElevated(
        () => api.finPost(`/dunning/cases/${String(selected.id)}${path}`),
        label,
      )
      if (!result) return
      addToast({ variant: 'success', title: `${label} completed` })
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

  return (
    <FinAdminGate title="Dunning cases">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Review automated past-due invoice progression and manually advance or cure exception cases.
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="dunning-status-filter" className="text-xs text-[var(--lc-text-muted)]">
            Status filter
          </label>
          <select
            id="dunning-status-filter"
            className="mt-1 min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="open">Open cases</option>
            <option value="all">All</option>
            <option value="OPEN">OPEN</option>
            <option value="REMINDING">REMINDING</option>
            <option value="CURED">CURED</option>
            <option value="WRITTEN_OFF">WRITTEN_OFF</option>
          </select>
        </div>
        <Button variant="outline" disabled={busy || !selected} onClick={() => void act('/advance', 'Advance stage')}>
          Advance selected
        </Button>
        <Button variant="outline" disabled={busy || !selected} onClick={() => void act('/cure', 'Cure case')}>
          Cure selected
        </Button>
        {selected ? (
          <span className="text-sm text-[var(--lc-text-muted)]">
            Selected <Numeric>{String(selected.id)}</Numeric>
            {' · '}
            <Badge variant="secondary">{String(selected.status || 'unknown')}</Badge>
          </span>
        ) : (
          <span className="text-sm text-[var(--lc-text-muted)]">Select a row to run manual actions.</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : (
        <FinTable
          columns={['id', 'tenant_id', 'invoice_id', 'status', 'created_at']}
          rows={filtered}
          onRowClick={setSelected}
        />
      )}
    </FinAdminGate>
  )
}

export default DunningCasesPage
