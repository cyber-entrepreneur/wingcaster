import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { FinAdminGate, FinTable } from './shell'

export function FacilitiesPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    void api.finGet('/facilities').then((body) => setRows((body.facilities || []) as Array<Record<string, unknown>>))
  }, [])
  return (
    <FinAdminGate title="Facilities">
      <p className="mb-3 text-sm text-muted-foreground">
        Postpaid credit lines. Select a row to open facility detail and lifecycle actions.
      </p>
      <FinTable
        columns={['id', 'currency', 'limit_minor', 'status', 'net_terms_days']}
        rows={rows}
        onRowClick={(row) => navigate(`/admin/fin/facilities/${String(row.id)}`)}
      />
    </FinAdminGate>
  )
}
