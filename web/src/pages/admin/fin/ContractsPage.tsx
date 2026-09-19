import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { FinAdminGate, FinTable } from './shell'

export function ContractsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    void api.finGet('/contracts').then((body) => setRows((body.contracts || []) as Array<Record<string, unknown>>))
  }, [])
  return (
    <FinAdminGate title="Contracts">
      <FinTable
        columns={['contract_number', 'status', 'billing_currency', 'starts_at', 'ends_at']}
        rows={rows}
        onRowClick={(row) => navigate(`/admin/fin/contracts/${String(row.id)}`)}
      />
    </FinAdminGate>
  )
}
