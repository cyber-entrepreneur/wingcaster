import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { FinAdminGate, FinTable } from './shell'

export function ExceptionsPage() {
  const [tab, setTab] = useState<'types' | 'quiet'>('types')
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [quietRows, setQuietRows] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    void api.finGet('/exceptions').then((body) => setRows((body.types || []) as Array<Record<string, unknown>>))
    void api.finGet('/cutover/quiet-period/events').then((body) => {
      setQuietRows((body.events || []) as Array<Record<string, unknown>>)
    }).catch(() => setQuietRows([]))
  }, [])
  return (
    <FinAdminGate title="Exceptions">
      <div className="mb-3 flex gap-2 text-sm">
        <button
          type="button"
          className={`rounded border px-2 py-1 ${tab === 'types' ? 'bg-muted' : ''}`}
          onClick={() => setTab('types')}
        >
          Spec §107
        </button>
        <button
          type="button"
          className={`rounded border px-2 py-1 ${tab === 'quiet' ? 'bg-muted' : ''}`}
          onClick={() => setTab('quiet')}
        >
          Quiet period
        </button>
      </div>
      {tab === 'types' ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">Spec §107 — 18 exception types plus quiet-period events.</p>
          <FinTable columns={['type', 'count', 'deferred', 'dl']} rows={rows} />
        </>
      ) : (
        <FinTable
          columns={['kind', 'source_file', 'message', 'occurred_at']}
          rows={quietRows}
        />
      )}
    </FinAdminGate>
  )
}
