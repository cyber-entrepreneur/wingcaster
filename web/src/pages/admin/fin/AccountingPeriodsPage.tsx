/**
 * PA-ACC-001 — Accounting periods index (SOX close lifecycle).
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { FinAdminGate, FinTable } from './shell'

const STATUSES = ['OPEN', 'SOFT_CLOSED', 'HARD_CLOSED'] as const

export function AccountingPeriodsPage() {
  const { addToast } = useToast()

  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [approvalId, setApprovalId] = useState('')
  const [busy, setBusy] = useState(false)

  function reload() {
    setLoading(true)
    void api.finGet('/accounting/periods')
      .then((body) => setRows((body.periods || []) as Array<Record<string, unknown>>))
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load accounting periods',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((row) => String(row.status || '') === statusFilter)
  }, [rows, statusFilter])

  async function act(path: string, label: string, body: Record<string, unknown> = {}) {
    if (!selected?.id) {
      addToast({ variant: 'error', title: 'Select an accounting period first.' })
      return
    }
    setBusy(true)
    try {
      await api.finPost(`/accounting/periods/${String(selected.id)}${path}`, body)
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
    <FinAdminGate title="Accounting periods">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Review legal-entity SOX accounting periods and run soft close, hard close, or reopen actions.
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="accounting-status-filter" className="text-xs text-[var(--lc-text-muted)]">
            Status filter
          </label>
          <select
            id="accounting-status-filter"
            className="mt-1 min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          disabled={busy || !selected || selected.status !== 'OPEN'}
          onClick={() => void act('/soft-close', 'Soft close')}
        >
          Soft close
        </Button>
        <Button
          variant="outline"
          disabled={busy || !selected || selected.status !== 'SOFT_CLOSED'}
          onClick={() => void act('/hard-close', 'Hard close')}
        >
          Hard close
        </Button>
        <div>
          <label htmlFor="accounting-reopen-approval" className="text-xs text-[var(--lc-text-muted)]">
            Reopen approval id
          </label>
          <input
            id="accounting-reopen-approval"
            className="mt-1 block min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
            value={approvalId}
            onChange={(e) => setApprovalId(e.target.value)}
            placeholder="UUID"
          />
        </div>
        <Button
          variant="outline"
          disabled={busy || !selected || selected.status !== 'HARD_CLOSED' || !approvalId.trim()}
          onClick={() => void act('/reopen', 'Reopen', { approval_request_id: approvalId.trim() })}
        >
          Reopen
        </Button>
        {selected ? (
          <span className="text-sm text-[var(--lc-text-muted)]">
            Selected <Numeric>{String(selected.period_key || selected.id)}</Numeric>
            {' · '}
            <Badge variant="secondary">{String(selected.status || 'unknown')}</Badge>
          </span>
        ) : (
          <span className="text-sm text-[var(--lc-text-muted)]">Select a row to run close actions.</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : (
        <FinTable
          columns={['period_key', 'status', 'starts_at', 'ends_at', 'closed_at', 'legal_entity_id']}
          rows={filtered}
          onRowClick={setSelected}
        />
      )}
    </FinAdminGate>
  )
}

export default AccountingPeriodsPage
