import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FinAction, FinAdminGate, FinTable } from './shell'

export function PackagesPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  function reload() {
    void api.finGet('/packages').then((body) => setRows((body.packages || []) as Array<Record<string, unknown>>))
  }
  useEffect(() => { reload() }, [])
  return (
    <FinAdminGate title="Packages">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input placeholder="code" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
        <Input placeholder="display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-48" />
        <Button size="sm" onClick={() => {
          if (!code || !displayName) return
          void api.finPost('/packages', {
            code, display_name: displayName, tier: 'starter', target_audience: 'agent', billing_cadence: 'monthly',
          }).then((row) => navigate(`/admin/fin/packages/${String(row.id)}`))
        }}>Create package</Button>
      </div>
      <FinTable
        columns={['code', 'display_name', 'tier', 'target_audience', 'currency', 'active', 'subscribers_count']}
        rows={rows.map((row) => ({
          ...row,
          active: String(row.active),
          subscribers_count: String(row.subscribers_count ?? 0),
        }))}
        onRowClick={(row) => navigate(`/admin/fin/packages/${String(row.id)}`)}
      />
      <div className="mt-3">
        <FinAction label="Package approvals" onClick={() => navigate('/admin/fin/package-approvals')} />
      </div>
    </FinAdminGate>
  )
}
