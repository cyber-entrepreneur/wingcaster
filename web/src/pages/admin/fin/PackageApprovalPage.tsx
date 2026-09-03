import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinAction, FinAdminGate, FinTable } from './shell'

export function PackageApprovalPage() {
  const navigate = useNavigate()
  const { agent } = useAuth()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [reason, setReason] = useState('')
  function reload() {
    void api.finGet('/packages/pending-approvals').then((body) => {
      setRows((body.approvals || []) as Array<Record<string, unknown>>)
    })
  }
  useEffect(() => { reload() }, [])
  const own = selected && agent?.id && String(selected.requester_actor_id) === String(agent.id)

  return (
    <FinAdminGate title="Package approvals">
      <FinTable
        columns={['package_display_name', 'version_number', 'requester_actor_id', 'submitted_at']}
        rows={rows}
        onRowClick={(row) => setSelected(row)}
      />
      {selected ? (
        <Card className="mt-4">
          <CardHeader><CardTitle>Diff vs currently published</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>properties_covered ± {String((selected.diff as Record<string, unknown> | undefined)?.properties_covered_delta ?? 0)}</p>
            <p>monthly_price_minor ± {String((selected.diff as Record<string, unknown> | undefined)?.monthly_price_minor_delta ?? 0)}</p>
            <p>quotas added/removed/changed: {String((selected.diff as Record<string, unknown> | undefined)?.quotas_added ?? 0)} / {String((selected.diff as Record<string, unknown> | undefined)?.quotas_removed ?? 0)} / {String((selected.diff as Record<string, unknown> | undefined)?.quotas_changed ?? 0)}</p>
            <p>flags changed: {String((selected.diff as Record<string, unknown> | undefined)?.flags_changed ?? 0)}</p>
            {own ? <p className="text-destructive">you cannot approve your own submissions</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={Boolean(own)} onClick={() => {
                void api.finPost(`/packages/${String(selected.package_id)}/versions/${String(selected.id)}/approve`, {})
                  .then(() => { setSelected(null); reload() })
              }}>Approve</Button>
              <Input placeholder="reject reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-56" />
              <Button size="sm" variant="outline" onClick={() => {
                if (!reason.trim()) return
                void api.finPost(`/packages/${String(selected.package_id)}/versions/${String(selected.id)}/reject`, { reason })
                  .then(() => { setSelected(null); setReason(''); reload() })
              }}>Reject</Button>
              <FinAction label="View in editor" onClick={() => navigate(`/admin/fin/packages/${String(selected.package_id)}/versions/${String(selected.id)}`)} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </FinAdminGate>
  )
}
