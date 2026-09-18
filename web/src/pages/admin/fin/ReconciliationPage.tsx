import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { FinAction, FinAdminGate, FinTable } from './shell'
import { RunReconciliationDialog } from './RunReconciliationDialog'

export function ReconciliationPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [runOpen, setRunOpen] = useState(false)

  function reload() {
    void api.finGet('/reconciliation/runs').then((body) => setRows((body.runs || []) as Array<Record<string, unknown>>))
  }

  useEffect(() => { reload() }, [])

  return (
    <FinAdminGate title="Reconciliation">
      <div className="mb-3">
        <FinAction label="Run reconciliation" onClick={() => setRunOpen(true)} />
      </div>
      <RunReconciliationDialog
        open={runOpen}
        onOpenChange={setRunOpen}
        onCompleted={() => reload()}
      />
      <FinTable columns={['id', 'status', 'scope', 'started_at']} rows={rows} />
    </FinAdminGate>
  )
}
