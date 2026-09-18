import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FinAdminGate, FinTable } from './shell'
import { AddVendorRateDialog } from './AddVendorRateDialog'
import { vendorApi } from './vendor-api'

export function VendorCostsPage() {
  const navigate = useNavigate()
  const [body, setBody] = useState<Record<string, unknown> | null>(null)
  const [rateOpen, setRateOpen] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>()
  const [loadingStatements, setLoadingStatements] = useState<string | null>(null)

  function reload() {
    void api.finGet('/vendors').then(setBody).catch(() => setBody({ stage11: false, vendors: [] }))
  }

  useEffect(() => { reload() }, [])

  const vendors = (body?.vendors || []) as Array<Record<string, unknown>>
  const stage11Deferred = body?.stage11 === false && vendors.length === 0

  async function openLatestStatement(vendorId: string) {
    setLoadingStatements(vendorId)
    try {
      const statementsBody = await vendorApi.listStatements(vendorId)
      const statements = (statementsBody.statements || []) as Array<Record<string, unknown>>
      const latest = statements[0]
      const month = String(latest?.statement_period_key || '')
      if (month) {
        navigate(`/admin/fin/vendors/${encodeURIComponent(vendorId)}/statements/${encodeURIComponent(month)}`)
      }
    } catch {
      // no-op — detail page handles missing statements
    } finally {
      setLoadingStatements(null)
    }
  }

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
          <div className="mb-3 flex flex-wrap gap-2">
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
            {vendors.length ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { void openLatestStatement(String(vendors[0]?.id || '')) }}
              >
                View latest statement
              </Button>
            ) : null}
          </div>
          <AddVendorRateDialog
            open={rateOpen}
            onOpenChange={setRateOpen}
            vendors={vendors as Array<{ id: string; name: string; code?: string; currency?: string }>}
            initialVendorId={selectedVendorId}
            onApplied={reload}
          />
          <p className="mb-3 text-sm text-muted-foreground">
            Select a vendor to open its detail — rates, statements, and §106 margin.
          </p>
          <FinTable
            columns={['name', 'code', 'currency', 'mtd_units', 'mtd_cost_micro_usd', 'active_rate_versions']}
            rows={vendors}
            onRowClick={(row) => navigate(`/admin/fin/vendors/${String(row.id)}`)}
          />
          {loadingStatements ? (
            <p className="mt-2 text-sm text-muted-foreground" role="status">Loading statements…</p>
          ) : null}
        </>
      )}
    </FinAdminGate>
  )
}
