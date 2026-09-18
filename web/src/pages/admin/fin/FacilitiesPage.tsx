import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { FinAdminGate, FinTable } from './shell'
import { CreateFacilityDialog } from './CreateFacilityDialog'
import { AdjustFacilityLimitDialog } from './AdjustFacilityLimitDialog'

export function FacilitiesPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [limitOpen, setLimitOpen] = useState(false)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | undefined>()

  function reload() {
    setLoading(true)
    setError(null)
    void api.finGet('/facilities')
      .then((body) => setRows((body.facilities || []) as Array<Record<string, unknown>>))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load facilities')
        setRows([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  return (
    <FinAdminGate title="Facilities">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setCreateOpen(true)}>Create facility</Button>
        <Button size="sm" variant="outline" onClick={() => reload()}>Refresh</Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelectedFacilityId(undefined)
            setLimitOpen(true)
          }}
        >
          Adjust limit
        </Button>
      </div>

      {successId && (
        <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Facility <span className="font-mono text-xs">{successId}</span> created (PENDING). Activation follows WF-18 when required.
        </p>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading facilities…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && !rows.length && (
        <p className="text-sm text-muted-foreground">No credit facilities yet. Create one to get started.</p>
      )}
      {!loading && !error && rows.length > 0 && (
        <FinTable
          columns={['tenant_id', 'id', 'currency', 'limit_minor', 'current_draw_minor', 'status', 'net_terms_days', 'valid_from']}
          rows={rows}
          onRowClick={(row) => {
            setSelectedFacilityId(String(row.id || ''))
            setLimitOpen(true)
          }}
        />
      )}

      <AdjustFacilityLimitDialog
        open={limitOpen}
        onOpenChange={setLimitOpen}
        facilities={rows as Array<{
          id: string
          currency: string
          limit_minor: number | string
          current_draw_minor?: number | string
          status: string
          version?: number
        }>}
        initialFacilityId={selectedFacilityId}
        onAdjusted={reload}
      />
      <CreateFacilityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(facilityId) => {
          setSuccessId(facilityId)
          reload()
        }}
      />
    </FinAdminGate>
  )
}
