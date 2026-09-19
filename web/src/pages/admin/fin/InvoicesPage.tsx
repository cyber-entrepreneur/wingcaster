import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { FinAction, FinAdminGate, FinTable } from './shell'
import { CreateDebitNoteDialog, type DebitNoteInvoiceTarget } from './CreateDebitNoteDialog'

const DEBIT_NOTE_PARENT_STATUSES = new Set(['ISSUED', 'PART_PAID', 'PAID', 'UNCOLLECTIBLE'])

export function InvoicesPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [selected, setSelected] = useState<DebitNoteInvoiceTarget | null>(null)
  const [debitOpen, setDebitOpen] = useState(false)

  function reload() {
    void api.finGet('/invoices').then((body) => {
      const invoices = (body.invoices || []) as Array<Record<string, unknown>>
      setRows(invoices)
      setSelected((current) => {
        if (!current?.id) return current
        const next = invoices.find((row) => String(row.id) === String(current.id))
        return next
          ? {
              id: String(next.id),
              invoice_number: next.invoice_number as string | null | undefined,
              currency: next.currency as string | null | undefined,
              total_minor: next.total_minor as string | number | null | undefined,
              status: next.status as string | null | undefined,
            }
          : null
      })
    })
  }

  useEffect(() => { reload() }, [])

  const first = rows[0]
  const debitEligible = useMemo(
    () => Boolean(selected?.status && DEBIT_NOTE_PARENT_STATUSES.has(String(selected.status))),
    [selected],
  )

  return (
    <FinAdminGate title="Invoices">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FinAction label="Void" onClick={() => {
          if (!first?.id) return
          void api.finPost(`/invoices/${String(first.id)}/void`).then(() => reload())
        }} />
        <FinAction label="Credit note" onClick={() => {
          if (!first?.id) return
          void api.finPost(`/invoices/${String(first.id)}/credit-note`, { amount_minor: 1 }).then(() => reload())
        }} />
        <Button
          size="sm"
          variant="outline"
          disabled={!selected || !debitEligible}
          onClick={() => setDebitOpen(true)}
        >
          Create debit note
        </Button>
        {selected ? (
          <span className="text-sm text-[var(--lc-text-muted)]">
            Selected {String(selected.invoice_number || selected.id)}
          </span>
        ) : (
          <span className="text-sm text-[var(--lc-text-muted)]">Select an invoice row to create a debit note.</span>
        )}
      </div>
      <FinTable
        columns={['id', 'invoice_number', 'status', 'total_minor', 'due_at']}
        rows={rows}
        onRowClick={(row) => setSelected({
          id: String(row.id),
          invoice_number: row.invoice_number as string | null | undefined,
          currency: row.currency as string | null | undefined,
          total_minor: row.total_minor as string | number | null | undefined,
          status: row.status as string | null | undefined,
        })}
      />
      <CreateDebitNoteDialog
        open={debitOpen}
        onOpenChange={setDebitOpen}
        invoice={selected}
        onCreated={() => reload()}
      />
    </FinAdminGate>
  )
}
