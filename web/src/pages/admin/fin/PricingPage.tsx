import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { FinAdminGate, FinTable } from './shell'

export function PricingPage() {
  const navigate = useNavigate()
  const [prices, setPrices] = useState<Array<Record<string, unknown>>>([])
  const [model, setModel] = useState('PER_UNIT')
  const [units, setUnits] = useState('1')
  const [rate, setRate] = useState('100')
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    void api.finGet('/prices').then((body) => {
      setPrices((body.prices || []) as Array<Record<string, unknown>>)
    })
  }, [])

  async function simulate() {
    const body = await api.finGet(`/pricing?model=${encodeURIComponent(model)}&billable_units=${units}&unit_rate_minor=${rate}`)
    const sim = body.simulator as { amount_minor?: string } | undefined
    setResult(sim?.amount_minor ?? JSON.stringify(body))
  }

  return (
    <FinAdminGate title="Pricing">
      <section className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Prices</h2>
          <p className="text-sm text-muted-foreground">Select a row to open price detail and version lifecycle.</p>
        </div>
        <FinTable
          columns={['code', 'currency', 'meter_id', 'version']}
          rows={prices}
          onRowClick={(row) => navigate(`/admin/fin/pricing/${String(row.id)}`)}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Simulator</h2>
        <Card className="max-w-lg">
          <CardContent className="space-y-3 pt-6">
            <div>
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div>
              <Label>Billable units</Label>
              <Input value={units} onChange={(e) => setUnits(e.target.value)} />
            </div>
            <div>
              <Label>Unit rate (minor)</Label>
              <Input value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <Button onClick={() => void simulate()}>Simulate</Button>
            {result ? <p className="text-sm">amount_minor: {result}</p> : null}
          </CardContent>
        </Card>
      </section>
    </FinAdminGate>
  )
}
