import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { FinAdminGate, FinTable } from './shell'

interface ExceptionTypeRow {
  type: string
  count: number
  deferred: boolean
  dl?: string | null
}

interface ExceptionItemRow {
  id: string
  exception_type: string
  severity: string
  status: string
  tenant_id?: string | null
  description: string
  created_at: string
}

export function ExceptionsPage() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<ExceptionTypeRow[]>([])
  const [items, setItems] = useState<ExceptionItemRow[]>([])
  useEffect(() => {
    void api.finGet('/exceptions').then((body) => {
      setTypes((body.types || []) as ExceptionTypeRow[])
    })
    void api.finGet('/exceptions/items').then((body) => {
      setItems((body.items || []) as ExceptionItemRow[])
    })
  }, [])
  return (
    <FinAdminGate title="Exceptions">
      <p className="mb-3 text-sm text-muted-foreground">Spec §107 — 18 exception types.</p>
      <h2 className="mb-2 text-lg font-semibold">Type summary</h2>
      <FinTable
        columns={['type', 'count', 'deferred', 'dl']}
        rows={types as unknown as Array<Record<string, unknown>>}
      />
      <h2 className="mb-2 mt-6 text-lg font-semibold">Open items</h2>
      <FinTable
        columns={['exception_type', 'severity', 'status', 'tenant_id', 'description', 'created_at']}
        rows={items as unknown as Array<Record<string, unknown>>}
        onRowClick={(row) => navigate(`/admin/fin/exceptions/${encodeURIComponent(String(row.id))}`)}
      />
    </FinAdminGate>
  )
}
