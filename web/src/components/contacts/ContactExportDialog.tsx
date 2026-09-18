/**
 * AGT-CTC-005 — Contact export.
 *
 * A Pro bulk-toolbar modal (from the contacts list, AGT-CTC-001) to download the
 * agent's contacts as CSV or vCard, with a per-column picker for CSV. The file
 * is fetched with the caller's auth header and streamed to a Blob so the browser
 * saves a real file. GDPR-minded: the export carries provenance + activity
 * columns and is scoped server-side to the caller's own contacts.
 */
import { useMemo, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { CONTACT_EXPORT_FIELDS, type ContactExportFormat, api, getAuthToken } from '@/api/client'
import { cn } from '@/lib/utils'

interface ContactExportDialogProps {
  open: boolean
  onClose: () => void
  /** Shown as context so the user knows how many rows will be exported. */
  contactCount: number
}

const RADIO_CLASS =
  'flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors'

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = /filename="?([^"]+)"?/.exec(header)
  return match?.[1] || fallback
}

export function ContactExportDialog({ open, onClose, contactCount }: ContactExportDialogProps) {
  const { addToast } = useToast()
  const [format, setFormat] = useState<ContactExportFormat>('csv')
  const [fields, setFields] = useState<Set<string>>(() => new Set(CONTACT_EXPORT_FIELDS.map((f) => f.key)))
  const [exporting, setExporting] = useState(false)

  const selectedFieldKeys = useMemo(
    () => CONTACT_EXPORT_FIELDS.filter((f) => fields.has(f.key)).map((f) => f.key),
    [fields],
  )

  const toggleField = (key: string) =>
    setFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const csvNoFields = format === 'csv' && selectedFieldKeys.length === 0

  const handleExport = async () => {
    if (csvNoFields) return
    setExporting(true)
    try {
      const path = api.contactsExportPath({
        format,
        fields: format === 'csv' ? selectedFieldKeys : undefined,
      })
      const token = getAuthToken()
      const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const fallback = `contacts.${format === 'vcard' ? 'vcf' : 'csv'}`
      const filename = filenameFromDisposition(res.headers.get('content-disposition'), fallback)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      addToast({ title: 'Export ready', description: `Downloaded ${filename}.`, variant: 'success' })
      onClose()
    } catch (e) {
      addToast({ title: 'Export failed', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export contacts</DialogTitle>
          <DialogDescription>
            Download your {contactCount} contact{contactCount === 1 ? '' : 's'} as a file. The export is limited to contacts assigned to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>Format</Label>
            <div className="mt-1.5 flex gap-2">
              <label className={cn(RADIO_CLASS, format === 'csv' ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-secondary)]' : 'border-[var(--lc-border-strong)]')}>
                <input type="radio" name="export-format" value="csv" checked={format === 'csv'} onChange={() => setFormat('csv')} />
                <span>
                  <span className="block font-medium">CSV</span>
                  <span className="block text-xs text-muted-foreground">Spreadsheet (Excel, Sheets)</span>
                </span>
              </label>
              <label className={cn(RADIO_CLASS, format === 'vcard' ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-secondary)]' : 'border-[var(--lc-border-strong)]')}>
                <input type="radio" name="export-format" value="vcard" checked={format === 'vcard'} onChange={() => setFormat('vcard')} />
                <span>
                  <span className="block font-medium">vCard</span>
                  <span className="block text-xs text-muted-foreground">Address book (.vcf)</span>
                </span>
              </label>
            </div>
          </div>

          {format === 'csv' && (
            <div>
              <Label>Columns</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {CONTACT_EXPORT_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={fields.has(f.key)} onChange={() => toggleField(f.key)} aria-label={f.label} />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
              {csvNoFields && <p className="mt-2 text-xs text-[var(--lc-status-unpublished-fg)]">Select at least one column.</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exporting}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting || csvNoFields} className="gap-1.5">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
