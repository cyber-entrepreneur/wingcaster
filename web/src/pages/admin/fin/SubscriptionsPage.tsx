import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import { FinAdminGate, FinTable } from './shell'

export function SubscriptionsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [status, setStatus] = useState('')
  const [tier, setTier] = useState('')
  function reload() {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    void api.finGet(`/subscriptions${q.toString() ? `?${q}` : ''}`).then((body) => {
      const list = (body.subscriptions || []) as Array<Record<string, unknown>>
      setRows(tier ? list.filter((row) => String(row.tier) === tier) : list)
    })
  }
  useEffect(() => { reload() }, [status, tier])
  return (
    <FinAdminGate title="Subscriptions">
      <div className="mb-3 flex gap-2">
        <Input placeholder="status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" />
        <Input placeholder="tier" value={tier} onChange={(e) => setTier(e.target.value)} className="w-40" />
      </div>
      <FinTable
        columns={['id', 'tenant_id', 'package_code', 'tier', 'status', 'properties_committed']}
        rows={rows}
        onRowClick={(row) => navigate(`/admin/fin/subscriptions/${String(row.id)}`)}
      />
    </FinAdminGate>
  )
}
