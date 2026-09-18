import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { FinAdminGate, FinTable } from './shell'

export function VendorCostsPage() {
  const navigate = useNavigate()
  const [body, setBody] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const load = () => {
    setLoading(true)
    setError(false)
    void api.finGet('/vendors')
      .then(setBody)
      .catch(() => {
        setBody(null)
        setError(true)
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])
  const vendors = (body?.vendors || []) as Array<Record<string, unknown>>
  return (
    <FinAdminGate title="Vendor costs">
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">Loading vendors…</p>
      ) : error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
          <span>Couldn&apos;t load vendors.</span>
          <Button type="button" variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      ) : (
        <FinTable
          columns={['name', 'currency', 'active_rate_versions', 'mtd_units', 'mtd_cost_micro_usd']}
          rows={vendors}
          onRowClick={(row) => navigate(`/admin/fin/vendors/${String(row.id)}`)}
        />
      )}
    </FinAdminGate>
  )
}
