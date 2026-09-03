import { useCallback, useEffect, useState } from 'react'
import { api, type TenantInvoice } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

export function MyInvoicesPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Invoices')
  const [invoices, setInvoices] = useState<TenantInvoice[]>([])

  const load = useCallback(async () => {
    try {
      const res = await api.getTenantInvoices()
      setInvoices(res.invoices)
    } catch (err: any) {
      addToast({ title: 'Could not load invoices', description: err.message, variant: 'error' })
    }
  }, [addToast])

  useEffect(() => { if (agent) load() }, [agent, load])

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
      {invoices.length === 0 ? (
        <p className="text-muted-foreground">No invoices yet.</p>
      ) : invoices.map((invoice) => (
        <Card key={invoice.id}>
          <CardHeader>
            <CardTitle className="text-lg">{invoice.invoice_number || invoice.id.slice(0, 8)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(invoice.total_minor / 100).toFixed(2)} {invoice.currency} · {invoice.status}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
