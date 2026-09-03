import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import { FinAction, FinAdminGate } from './shell'

export function SubscriptionDetailPage() {
  const { id } = useParams()
  const [row, setRow] = useState<Record<string, unknown> | null>(null)
  const [planId, setPlanId] = useState('')
  function reload() {
    if (!id) return
    void api.finGet(`/subscriptions/${id}`).then((body) => setRow(body))
  }
  useEffect(() => { reload() }, [id])
  function act(path: string, body: Record<string, unknown> = {}) {
    if (!id) return
    void api.finPost(`/subscriptions/${id}${path}`, body).then(() => reload())
  }
  return (
    <FinAdminGate title="Subscription">
      <dl className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
        <div>Package: {String(row?.package_display_name || '')} v{String(row?.version_number || '')}</div>
        <div>Status: {String(row?.status || '')}</div>
        <div>Cycle: {String(row?.billing_cycle_start || '')} → {String(row?.billing_cycle_end || '')}</div>
        <div>Next grant: {String(row?.next_grant_at || '')}</div>
        <div>Properties committed: {String(row?.properties_committed || '')}</div>
        <div>Active properties: {String(row?.active_properties_count || 0)}</div>
      </dl>
      <div className="mb-3 flex flex-wrap gap-2">
        <FinAction label="Pause" onClick={() => act('/pause', { reason: 'admin' })} />
        <FinAction label="Resume" onClick={() => act('/resume')} />
        <FinAction label="Cancel at period end" onClick={() => act('/cancel-at-period-end', { reason: 'admin' })} />
        <FinAction label="Cancel immediate" onClick={() => act('/cancel-immediate', { reason: 'admin' })} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder="new package_version_id" value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-72" />
        <FinAction label="Change plan" onClick={() => act('/change-plan', { package_version_id: planId })} />
      </div>
    </FinAdminGate>
  )
}
