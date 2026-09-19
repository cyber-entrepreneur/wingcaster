import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FinAdminGate, FinTable } from './shell'
import { AddVendorRateDialog } from './AddVendorRateDialog'

export function VendorCostsPage() {
  const [body, setBody] = useState<Record<string, unknown> | null>(null)
  const [rateOpen, setRateOpen] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>()

  function reload() {
    void api.finGet('/vendors').then(setBody).catch(() => setBody({ stage11: false, vendors: [] }))
  }

  useEffect(() => { reload() }, [])

  const vendors = (body?.vendors || []) as Array<Record<string, unknown>>
  const stage11Deferred = body?.stage11 === false && vendors.length === 0

  return (
    <FinAdminGate title="Vendor costs">
      {stage11Deferred ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Stage 11 not merged — vendor rates, statements, and §106 margin drilldown will appear here after rebase.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedVendorId(undefined)
                setRateOpen(true)
              }}
            >
              Add rate
            </Button>
          </div>
          <AddVendorRateDialog
            open={rateOpen}
            onOpenChange={setRateOpen}
            vendors={vendors as Array<{ id: string; name: string; code?: string; currency?: string }>}
            initialVendorId={selectedVendorId}
            onApplied={reload}
          />
          <FinTable
            columns={['name', 'code', 'currency', 'mtd_units', 'mtd_cost_micro_usd', 'active_rate_versions']}
            rows={vendors}
            onRowClick={(row) => {
              setSelectedVendorId(String(row.id || ''))
              setRateOpen(true)
            }}
          />
        </>
      )}
    </FinAdminGate>
  )
}
